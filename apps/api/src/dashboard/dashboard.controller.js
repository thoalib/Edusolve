import { ALL_ROLES } from '../common/roles.js';
import { sendJson } from '../common/http.js';
import { getSupabaseAdminClient } from '../config/supabase.js';
import { getRate, getRateConfig, classToLevel } from '../hr/salary.service.js';

export async function handleDashboard(req, res) {
  if (req.method === 'GET' && req.url.startsWith('/dashboard/')) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const role = parsedUrl.pathname.replace('/dashboard/', '').trim();
    const from = parsedUrl.searchParams.get('from');
    const to = parsedUrl.searchParams.get('to');
    const toDate = to ? (to.includes('T') ? to : to + 'T23:59:59.999Z') : null;

    // Allow SUPER_ADMIN to access their specific dashboard data
    if (role === 'super-admin') {
      const adminClient = getSupabaseAdminClient();
      if (!adminClient) {
        sendJson(res, 500, { ok: false, error: 'Database configuration missing' });
        return true;
      }

      try {
        // Build date-filtered lead queries
        let totalLeadsQ = adminClient.from('leads').select('*', { count: 'exact', head: true });
        let newLeadsQ = adminClient.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new');
        let incomeQ = adminClient.from('ledger_entries').select('amount').eq('entry_type', 'income');
        let expenseQ = adminClient.from('expenses').select('amount');
        let teacherPayableQ = adminClient.from('ledger_entries').select('teacher_id, amount').eq('entry_type', 'payable').not('teacher_id', 'is', null);
        let teacherExpenseQ = adminClient.from('expenses').select('teacher_id, amount').not('teacher_id', 'is', null);
        let studentLedgerQ = adminClient.from('ledger_entries').select('student_id, amount, entry_type').in('entry_type', ['receivable', 'income']).not('student_id', 'is', null);
        
        let estimatedPaySessionsQ = adminClient
          .from('session_verifications')
          .select('session_id, academic_sessions!inner(id, teacher_id, duration_hours, session_date, subject, students(class_level, board))')
          .eq('type', 'approval')
          .eq('status', 'approved');

        // Apply date filters
        if (from) {
          totalLeadsQ = totalLeadsQ.gte('created_at', from);
          newLeadsQ = newLeadsQ.gte('created_at', from);
          incomeQ = incomeQ.gte('created_at', from);
          expenseQ = expenseQ.gte('created_at', from);
        }
        if (toDate) {
          totalLeadsQ = totalLeadsQ.lte('created_at', toDate);
          newLeadsQ = newLeadsQ.lte('created_at', toDate);
          incomeQ = incomeQ.lte('created_at', toDate);
          expenseQ = expenseQ.lte('created_at', toDate);
        }

        const [
          { count: totalLeads },
          { count: newLeads },
          { count: totalStudents },
          { count: totalTeachers },
          { data: incomeData },
          { data: expenseData },
          { data: teacherPayableEntries },
          { data: teacherExpenseEntries },
          { data: studentLedgerData },
          { data: estimatedPaySessionsData },
          { data: teachersData },
          rateConfig,
          { data: billedPayrollsData }
        ] = await Promise.all([
          totalLeadsQ,
          newLeadsQ,
          adminClient.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          adminClient.from('teacher_profiles').select('*', { count: 'exact', head: true }).eq('is_in_pool', true),
          incomeQ,
          expenseQ,
          teacherPayableQ,
          teacherExpenseQ,
          studentLedgerQ,
          estimatedPaySessionsQ,
          adminClient.from('teacher_profiles').select('*').eq('is_in_pool', true),
          getRateConfig(),
          adminClient.from('hr_payment_requests').select('teacher_id, year, month').eq('target_type', 'teacher')
        ]);

        const totalIncome = (incomeData || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const totalExpenses = (expenseData || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
        // Teacher payable = total payable entries - total expenses paid to teachers (net balance we still owe)
        const totalTeacherPayable = (teacherPayableEntries || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const totalTeacherPaid = (teacherExpenseEntries || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const teacherPayable = totalTeacherPayable - totalTeacherPaid;
        // Group ledger entries by student, compute receivable - income per student, sum only +ve (student still owes)
        const studentLedger = {};
        for (const row of (studentLedgerData || [])) {
          if (!row.student_id) continue;
          if (!studentLedger[row.student_id]) studentLedger[row.student_id] = { receivable: 0, income: 0 };
          if (row.entry_type === 'receivable') studentLedger[row.student_id].receivable += Number(row.amount || 0);
          else studentLedger[row.student_id].income += Number(row.amount || 0);
        }
        const pendingIncoming = Object.values(studentLedger)
          .reduce((sum, s) => sum + (s.receivable - s.income), 0);

        // Calculate Estimated Payroll
        const teacherMap = new Map();
        (teachersData || []).forEach(t => teacherMap.set(t.user_id, t));

        // Map of already-billed (Teacher, Year, Month) buckets
        const billedBuckets = new Set();
        (billedPayrollsData || []).forEach(b => {
          if (b.teacher_id) billedBuckets.add(`${b.teacher_id}_${b.year}_${b.month}`);
        });

        let estimatedPayable = 0;
        (estimatedPaySessionsData || []).forEach(sv => {
          const sess = sv.academic_sessions;
          if (!sess) return;
          const t = teacherMap.get(sess.teacher_id);
          if (!t) return;

          // Check if this session's bucket is already billed
          const sDate = new Date(sess.session_date);
          const sYear = sDate.getFullYear();
          const sMonth = sDate.getMonth() + 1;
          const bucketKey = `${sess.teacher_id}_${sYear}_${sMonth}`;
          if (billedBuckets.has(bucketKey)) return;

          const level = classToLevel(sess.students?.class_level);
          const rate = getRate(t, sess.students?.board, sess.subject, level, rateConfig);
          estimatedPayable += (Number(sess.duration_hours || 0) * rate);
        });

        const stats = {
          leads: { total: totalLeads || 0, new: newLeads || 0 },
          students: { total: totalStudents || 0 },
          teachers: { total: totalTeachers || 0 },
          finance: {
            income: totalIncome,
            expenses: totalExpenses,
            net: totalIncome - totalExpenses,
            teacherPayable,
            pendingIncoming,
            estimatedPayable: Math.round(estimatedPayable * 100) / 100
          }
        };

        sendJson(res, 200, { ok: true, stats });
        return true;

      } catch (err) {
        console.error('Super Admin Dashboard Error:', err);
        sendJson(res, 500, { ok: false, error: 'Failed to aggregate dashboard stats' });
        return true;
      }
    }

    if (!ALL_ROLES.includes(role)) {
      sendJson(res, 404, { ok: false, error: 'dashboard not found' });
      return true;
    }

    sendJson(res, 200, { ok: true, role, message: `${role} dashboard scaffold ready` });
    return true;
  }

  return false;
}
