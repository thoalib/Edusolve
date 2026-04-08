import { getSupabaseAdminClient } from '../config/supabase.js';
import { notifyBulkScheduledToday, notifySessionRescheduled } from '../common/n8n-webhook.js';
import { readJson, sendJson } from '../common/http.js';
import { WaappaService } from '../waappa/waappa.service.js';
import { z } from 'zod';
import { phoneSchema, validatePayload } from '../common/validation.js';

// -- Zod Schemas --
const sendReminderSchema = z.object({
  text: z.string().max(1000).optional()
});

const whatsappGroupSchema = z.object({
  name: z.string().max(100).optional()
});

const updateStudentSchema = z.object({
  student_name: z.string().max(150).optional(),
  parent_name: z.string().max(150).optional(),
  country_code: z.string().max(10).optional(),
  contact_number: phoneSchema.optional(),
  alternative_number: phoneSchema.optional(),
  parent_phone: phoneSchema.optional(),
  messaging_number: z.enum(['contact', 'alternative', 'parent']).optional(),
  class_level: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  package_name: z.string().max(100).optional(),
  board: z.string().max(100).optional(),
  medium: z.string().max(50).optional(),
  status: z.enum(['active', 'vacation', 'inactive']).optional()
});

const studentStatusSchema = z.object({
  status: z.enum(['active', 'vacation', 'inactive'])
});

const reassignACSchema = z.object({
  academic_coordinator_id: z.string().uuid()
});

const createAssignmentSchema = z.object({
  teacher_id: z.string().uuid(),
  subject: z.string().max(100),
  day: z.string().max(20).nullable().optional(),
  time: z.string().max(20).nullable().optional(),
  schedule_note: z.string().max(500).nullable().optional()
});

const createSessionSchema = z.object({
  teacher_id: z.string().uuid(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required'),
  started_at: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional(),
  ended_at: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional(),
  duration_hours: z.coerce.number().positive(),
  subject: z.string().max(100).nullable().optional(),
  homework: z.string().max(500).nullable().optional()
});

const bulkSessionSchema = z.object({
  teacher_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days_of_week: z.array(z.enum(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])).min(1),
  started_at: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  duration_hours: z.coerce.number().positive(),
  subject: z.string().max(100).optional()
});

const rescheduleSessionSchema = z.object({
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  started_at: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  ended_at: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  status: z.enum(['scheduled', 'rescheduled', 'completed', 'cancelled', 'held']).optional(),
  duration_hours: z.coerce.number().positive().optional(),
  subject: z.string().max(100).optional(),
  teacher_id: z.string().uuid().optional()
});

const messageReminderSchema = z.object({
  message: z.string().max(1000).optional(),
  type: z.string().max(50).optional(),
  session_id: z.string().uuid().optional()
});

const topupSchema = z.object({
  hours_added: z.coerce.number().min(0.1),
  total_amount: z.coerce.number().positive(),
  amount: z.coerce.number().min(0),
  finance_note: z.string().max(1000).optional().nullable(),
  screenshot_url: z.string().url().max(500).optional().nullable()
});


const waappaService = new WaappaService();

const nowIso = () => new Date().toISOString();

function actorFromHeaders(req) {
  const rawRole = req.headers['x-user-role'];
  const rawId = req.headers['x-user-id'];
  return {
    role: typeof rawRole === 'string' ? rawRole : 'unknown',
    userId: typeof rawId === 'string' ? rawId : ''
  };
}

function canViewStudents(actor) {
  return ['academic_coordinator', 'finance', 'super_admin', 'counselor'].includes(actor.role);
}

function canRequestTopup(actor) {
  return actor.role === 'academic_coordinator';
}

function isAC(actor) {
  return actor.role === 'academic_coordinator';
}

async function generateStudentCode(adminClient) {
  const MONTH_CODES = ['JA', 'FB', 'MR', 'AP', 'MY', 'JN', 'JL', 'AG', 'SP', 'OC', 'NV', 'DC'];
  const now = new Date();
  const monthCode = MONTH_CODES[now.getMonth()];
  const yearCode = String(now.getFullYear()).slice(-2);

  // Get the current max sequential number
  const { count: totalStudents, error } = await adminClient
    .from('students')
    .select('*', { count: 'exact', head: true });

  if (error) throw new Error(error.message);

  const seq = (totalStudents || 0) + 1;
  return `${monthCode}0${yearCode}0${seq}`;
}

function verificationStatusOf(session) {
  const row = Array.isArray(session.session_verifications) ? session.session_verifications[0] : session.session_verifications;
  return row?.status || 'pending';
}

export async function handleStudents(req, res, url) {
  if (!url.pathname.startsWith('/students') && !url.pathname.startsWith('/academic')) return false;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    sendJson(res, 500, { ok: false, error: 'supabase admin is not configured' });
    return true;
  }

  const actor = actorFromHeaders(req);
  const parts = url.pathname.split('/').filter(Boolean);

  try {

    // ══════════════════════════════════════════════════════════
    // ══  STUDENT PORTAL ENDPOINTS (role: student)  ═══════════
    // ══════════════════════════════════════════════════════════

    // ─── GET /students/my-dashboard ─────────────────────────
    if (req.method === 'GET' && url.pathname === '/students/my-dashboard') {
      if (actor.role !== 'student') { sendJson(res, 403, { ok: false, error: 'student role required' }); return true; }
      const studentId = actor.userId;

      // Fetch student profile
      const { data: student, error: sErr } = await adminClient
        .from('students')
        .select('id, student_name, student_code, class_level, board, medium, country, status, remaining_hours, total_hours, contact_number, academic_coordinator_id, joined_at, package_name')
        .eq('id', studentId)
        .is('deleted_at', null)
        .maybeSingle();
      if (sErr || !student) { sendJson(res, 404, { ok: false, error: 'student not found' }); return true; }

      // Fetch AC name
      let acName = null;
      if (student.academic_coordinator_id) {
        const { data: acUser } = await adminClient.from('users').select('full_name').eq('id', student.academic_coordinator_id).maybeSingle();
        acName = acUser?.full_name || null;
      }

      // Fetch today's sessions
      const nowRaw = new Date();
      const istStr = nowRaw.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      const now = new Date(istStr);
      const pad = n => String(n).padStart(2, '0');
      const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      const { data: todaySessions } = await adminClient
        .from('academic_sessions')
        .select('id, session_date, started_at, duration_hours, subject, status, teacher_id, users!academic_sessions_teacher_id_fkey(full_name)')
        .eq('student_id', studentId)
        .eq('session_date', todayDate)
        .order('started_at', { ascending: true });

      // Fetch recent sessions (last 10)
      const { data: recentSessions } = await adminClient
        .from('academic_sessions')
        .select('id, session_date, started_at, duration_hours, subject, status, teacher_id, users!academic_sessions_teacher_id_fkey(full_name), session_verifications(status)')
        .eq('student_id', studentId)
        .order('session_date', { ascending: false })
        .limit(10);

      // Fetch assigned teachers
      const { data: assignments } = await adminClient
        .from('student_teacher_assignments')
        .select('teacher_id, subject, is_active, users!student_teacher_assignments_teacher_id_fkey(full_name)')
        .eq('student_id', studentId)
        .eq('is_active', true);

      sendJson(res, 200, {
        ok: true,
        student: { ...student, ac_name: acName },
        todaySessions: (todaySessions || []).map(s => ({ ...s, teacher_name: s.users?.full_name || 'Teacher' })),
        recentSessions: (recentSessions || []).map(s => ({ ...s, teacher_name: s.users?.full_name || 'Teacher', verification_status: verificationStatusOf(s) })),
        assignments: (assignments || []).map(a => ({ teacher_id: a.teacher_id, subject: a.subject, teacher_name: a.users?.full_name || 'Teacher' }))
      });
      return true;
    }

    // ─── GET /students/my-sessions ──────────────────────────
    if (req.method === 'GET' && url.pathname === '/students/my-sessions') {
      if (actor.role !== 'student') { sendJson(res, 403, { ok: false, error: 'student role required' }); return true; }
      const studentId = actor.userId;

      const { data: sessions, error } = await adminClient
        .from('academic_sessions')
        .select('id, session_date, started_at, duration_hours, subject, status, teacher_id, users!academic_sessions_teacher_id_fkey(full_name), session_verifications(status)')
        .eq('student_id', studentId)
        .order('session_date', { ascending: false });
      if (error) throw new Error(error.message);

      sendJson(res, 200, {
        ok: true,
        items: (sessions || []).map(s => ({
          ...s,
          teacher_name: s.users?.full_name || 'Teacher',
          verification_status: verificationStatusOf(s)
        }))
      });
      return true;
    }

    // ─── GET /students/my-payments ──────────────────────────
    if (req.method === 'GET' && url.pathname === '/students/my-payments') {
      if (actor.role !== 'student') { sendJson(res, 403, { ok: false, error: 'student role required' }); return true; }
      const studentId = actor.userId;

      // Get lead_id from student
      const { data: st } = await adminClient.from('students').select('id, lead_id').eq('id', studentId).maybeSingle();
      if (!st) { sendJson(res, 404, { ok: false, error: 'student not found' }); return true; }

      let paymentRequests = [];
      if (st.lead_id) {
        const { data: prs } = await adminClient
          .from('payment_requests')
          .select('id, amount, total_amount, hours, status, screenshot_url, created_at, verified_at, effective_date')
          .eq('lead_id', st.lead_id)
          .order('created_at', { ascending: false });
        paymentRequests = prs || [];
      }

      // Fetch top-ups
      const { data: topups } = await adminClient
        .from('student_topups')
        .select('id, hours_added, amount, total_amount, status, screenshot_url, created_at, verified_at, finance_note')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      // Fetch installments
      const { data: installments } = await adminClient
        .from('installment_payments')
        .select('id, reference_id, reference_type, amount, paid_at, screenshot_url, status, created_at')
        .or(`reference_id.in.(${[...paymentRequests.map(p => p.id), ...(topups || []).map(t => t.id)].join(',')})`)
        .order('created_at', { ascending: false });

      sendJson(res, 200, {
        ok: true,
        paymentRequests,
        topups: topups || [],
        installments: installments || []
      });
      return true;
    }

    // ─── GET /students/my-teachers ──────────────────────────
    if (req.method === 'GET' && url.pathname === '/students/my-teachers') {
      if (actor.role !== 'student') { sendJson(res, 403, { ok: false, error: 'student role required' }); return true; }
      const studentId = actor.userId;

      const { data, error } = await adminClient
        .from('student_teacher_assignments')
        .select('teacher_id, subject, is_active, users!student_teacher_assignments_teacher_id_fkey(full_name)')
        .eq('student_id', studentId)
        .eq('is_active', true);
      if (error) throw new Error(error.message);

      // Group by teacher
      const teacherMap = {};
      (data || []).forEach(a => {
        if (!teacherMap[a.teacher_id]) {
          teacherMap[a.teacher_id] = { teacher_id: a.teacher_id, teacher_name: a.users?.full_name || 'Teacher', subjects: [] };
        }
        teacherMap[a.teacher_id].subjects.push(a.subject);
      });

      sendJson(res, 200, { ok: true, items: Object.values(teacherMap) });
      return true;
    }

    // ─── GET /students/my-remarks ───────────────────────────
    if (req.method === 'GET' && url.pathname === '/students/my-remarks') {
      if (actor.role !== 'student') { sendJson(res, 403, { ok: false, error: 'student role required' }); return true; }
      const studentId = actor.userId;

      const { data, error } = await adminClient
        .from('student_remarks')
        .select('*, creator:created_by(id, full_name)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      sendJson(res, 200, { ok: true, items: data || [] });
      return true;
    }

    // ─── GET /students/my-materials/:teacherId ──────────────
    const myMaterialsMatch = url.pathname.match(/^\/students\/my-materials\/([0-9a-fA-F-]+)$/);
    if (req.method === 'GET' && myMaterialsMatch) {
      if (actor.role !== 'student') { sendJson(res, 403, { ok: false, error: 'student role required' }); return true; }
      const studentId = actor.userId;
      const teacherId = myMaterialsMatch[1];

      const { data, error } = await adminClient
        .from('material_transfers')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: true })
        .limit(2000);
      if (error) throw new Error(error.message);

      sendJson(res, 200, { ok: true, items: data || [] });
      return true;
    }

    // ─── POST /students/send-material ───────────────────────
    if (req.method === 'POST' && url.pathname === '/students/send-material') {
      if (actor.role !== 'student') { sendJson(res, 403, { ok: false, error: 'student role required' }); return true; }
      const studentId = actor.userId;
      const payload = await readJson(req);

      if (!payload.teacher_id || !payload.subject) {
        sendJson(res, 400, { ok: false, error: 'Missing teacher_id or subject' });
        return true;
      }

      // Validate assignment exists
      const { data: assignment } = await adminClient
        .from('student_teacher_assignments')
        .select('id, students(id, academic_coordinator_id, student_name), users!student_teacher_assignments_teacher_id_fkey(id, contact_number)')
        .eq('student_id', studentId)
        .eq('teacher_id', payload.teacher_id)
        .eq('subject', payload.subject)
        .eq('is_active', true)
        .maybeSingle();

      if (!assignment || !assignment.students) {
        sendJson(res, 403, { ok: false, error: 'No active assignment found for this teacher and subject.' });
        return true;
      }

      const student = assignment.students;
      const teacher = assignment.users;

      if (!teacher || !teacher.contact_number) {
        sendJson(res, 400, { ok: false, error: 'This teacher does not have a contact number registered for WhatsApp delivery.' });
        return true;
      }

      // Find AC WhatsApp session
      const { data: acSession } = await adminClient
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', student.academic_coordinator_id)
        .eq('status', 'WORKING')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const theSessionName = acSession?.session_name || null;
      const isOnline = !!theSessionName;

      let captionStr = `📝 ${payload.subject} - ${student.student_name} (Student)`;
      if (payload.caption_text) captionStr += `\n${payload.caption_text}`;

      const insertRecord = {
        student_id: student.id,
        teacher_id: payload.teacher_id,
        ac_id: student.academic_coordinator_id,
        subject: payload.subject,
        file_url: payload.file_url || null,
        mimetype: payload.mimetype || 'text',
        caption_text: captionStr,
        direction: 'student_to_teacher',
        status: isOnline ? 'pending' : 'failed',
        error_message: isOnline ? null : 'Coordinator WhatsApp session is offline.'
      };

      const { data: row, error: insErr } = await adminClient.from('material_transfers').insert(insertRecord).select('id').single();
      if (insErr) { sendJson(res, 500, { ok: false, error: 'Failed to record transfer.' }); return true; }

      if (!isOnline) {
        sendJson(res, 200, { ok: true, queued: true, message: 'Coordinator WhatsApp is offline. Material queued.' });
        return true;
      }

      const WAAPPA_BASE = process.env.WAAPPA_BASE_URL || 'http://main.waappa.com';
      const WAAPPA_KEY = acSession.api_key || process.env.WAAPPA_API_KEY || 'yoursecretkey';
      
      // Route directly to teacher's personal phone
      const teacherPhone = teacher.contact_number.replace(/\D/g, '');
      const destinationJid = `${teacherPhone}@c.us`;

      try {
        if (!payload.file_url) {
          await waappaService.sendText(theSessionName, WAAPPA_KEY, destinationJid, captionStr);
        } else {
          if ((payload.mimetype || '').toLowerCase().startsWith('audio/')) {
            await waappaService.sendText(theSessionName, WAAPPA_KEY, destinationJid, captionStr);
          }
          await waappaService.sendMedia(theSessionName, WAAPPA_KEY, destinationJid, payload.file_url, payload.mimetype, captionStr, payload.filename);
        }
        await adminClient.from('material_transfers').update({ status: 'sent', error_message: null }).eq('id', row.id);
        sendJson(res, 200, { ok: true, message: 'Material sent successfully' });
      } catch (extError) {
        await adminClient.from('material_transfers').update({ status: 'failed', error_message: extError.message }).eq('id', row.id);
        sendJson(res, 500, { ok: false, error: 'Delivery failed. Marked as failed.' });
      }
      return true;
    }

    // ─── POST /students/change-pin ──────────────────────────
    if (req.method === 'POST' && url.pathname === '/students/change-pin') {
      if (actor.role !== 'student') { sendJson(res, 403, { ok: false, error: 'student role required' }); return true; }
      const studentId = actor.userId;
      const payload = await readJson(req);

      if (!payload.current_pin || !payload.new_pin) {
        sendJson(res, 400, { ok: false, error: 'current_pin and new_pin are required' });
        return true;
      }
      if (!/^\d{6}$/.test(payload.new_pin)) {
        sendJson(res, 400, { ok: false, error: 'New PIN must be exactly 6 digits' });
        return true;
      }

      const { data: st } = await adminClient.from('students').select('login_pin').eq('id', studentId).maybeSingle();
      if (!st) { sendJson(res, 404, { ok: false, error: 'student not found' }); return true; }

      if ((st.login_pin || '123456') !== payload.current_pin) {
        sendJson(res, 400, { ok: false, error: 'Current PIN is incorrect' });
        return true;
      }

      // Check for PIN uniqueness among students with the same contact_number
      const { data: currentStudent } = await adminClient.from('students').select('contact_number').eq('id', studentId).maybeSingle();
      if (currentStudent?.contact_number) {
        const { data: conflict } = await adminClient
          .from('students')
          .select('id')
          .eq('contact_number', currentStudent.contact_number)
          .eq('login_pin', payload.new_pin)
          .neq('id', studentId)
          .is('deleted_at', null)
          .maybeSingle();

        if (conflict) {
          sendJson(res, 400, { ok: false, error: 'This PIN is already in use by another student sharing this contact number. Please use a unique PIN.' });
          return true;
        }
      }

      const { error } = await adminClient.from('students').update({ login_pin: payload.new_pin }).eq('id', studentId);
      if (error) throw new Error(error.message);

      sendJson(res, 200, { ok: true, message: 'PIN changed successfully' });
      return true;
    }

    // ─── PATCH /students/:id/reset-pin (AC/super_admin only) ─
    if (req.method === 'PATCH' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'reset-pin') {
      if (!['academic_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'only AC or super admin can reset student PIN' });
        return true;
      }
      const studentId = parts[1];

      // Check for PIN uniqueness among siblings (same contact_number) before resetting to 123456
      const { data: currentStudent } = await adminClient.from('students').select('contact_number').eq('id', studentId).maybeSingle();
      if (currentStudent?.contact_number) {
        const { data: conflict } = await adminClient
          .from('students')
          .select('id')
          .eq('contact_number', currentStudent.contact_number)
          .eq('login_pin', '123456') // DEFAULT PIN
          .neq('id', studentId)
          .is('deleted_at', null)
          .maybeSingle();

        if (conflict) {
          sendJson(res, 400, { ok: false, error: 'Reset failed: Another student with this phone number is already using the default PIN (123456). Please set a custom PIN for this student.' });
          return true;
        }
      }

      const { error } = await adminClient.from('students').update({ login_pin: '123456' }).eq('id', studentId);
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true, message: 'PIN reset to 123456' });
      return true;
    }

    // ══════════════════════════════════════════════════════════
    // ══  END STUDENT PORTAL ENDPOINTS  ═══════════════════════
    // ══════════════════════════════════════════════════════════

    // ─── GET /students ─────────────────────────────────────
    if (req.method === 'GET' && url.pathname === '/students') {
      if (!canViewStudents(actor)) {
        sendJson(res, 403, { ok: false, error: 'student access is not allowed for this role' });
        return true;
      }

      const acIdFilter = url.searchParams.get('ac_id') || url.searchParams.get('user_id') || '';

      let query = adminClient
        .from('students')
        .select('*, ac_user:academic_coordinator_id(id, full_name), student_teacher_assignments!student_teacher_assignments_student_id_fkey(id, teacher_id, subject, is_active, users!student_teacher_assignments_teacher_id_fkey(id, full_name)), leads!students_lead_id_fkey(source)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (isAC(actor)) {
        query = query.eq('academic_coordinator_id', actor.userId);
      } else if (actor.role === 'super_admin' && acIdFilter) {
        query = query.eq('academic_coordinator_id', acIdFilter);
      }

      const fromParam = url.searchParams.get('from');
      const toParam = url.searchParams.get('to');
      if (fromParam && toParam) {
        query = query.gte('created_at', fromParam.includes('T') ? fromParam : fromParam + 'T00:00:00+05:30')
                     .lte('created_at', toParam.includes('T') ? toParam : toParam + 'T23:59:59+05:30');
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const students = data || [];

      // Determine outstanding balance per student (total_amount > amount = outstanding)
      if (students.length > 0) {
        const studentIds = students.map(s => s.id);
        const leadIds = students.map(s => s.lead_id).filter(Boolean);

        const [topupRes, prRes] = await Promise.all([
          adminClient
            .from('student_topups')
            .select('student_id, total_amount, amount')
            .in('student_id', studentIds)
            .eq('status', 'approved'),
          leadIds.length > 0
            ? adminClient
              .from('payment_requests')
              .select('lead_id, total_amount, amount')
              .in('lead_id', leadIds)
              .eq('status', 'verified')
            : Promise.resolve({ data: [] })
        ]);

        const topupOutstandingMap = {};
        for (const t of (topupRes.data || [])) {
          const out = Number(t.total_amount || 0) - Number(t.amount || 0);
          if (out > 0) topupOutstandingMap[t.student_id] = (topupOutstandingMap[t.student_id] || 0) + out;
        }
        const prOutstandingMap = {};
        for (const p of (prRes.data || [])) {
          const out = Number(p.total_amount || 0) - Number(p.amount || 0);
          if (out > 0) prOutstandingMap[p.lead_id] = (prOutstandingMap[p.lead_id] || 0) + out;
        }

        for (const s of students) {
          const topupOut = topupOutstandingMap[s.id] || 0;
          const initialOut = s.lead_id ? (prOutstandingMap[s.lead_id] || 0) : 0;

          if (topupOut > 0) {
            s.pending_payment = 'topup';
            s.pending_amount = topupOut;
          } else if (initialOut > 0) {
            s.pending_payment = 'initial';
            s.pending_amount = initialOut;
          } else {
            s.pending_payment = null;
            s.pending_amount = 0;
          }
        }
      }

      sendJson(res, 200, { ok: true, items: students });
      return true;
    }

    // ─── POST /students ────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === '/students') {
      if (!isAC(actor) && actor.role !== 'super_admin') {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator or super admin can create students directly' });
        return true;
      }
      const payload = await readJson(req);

      const { data: acUserRow } = await adminClient.from('users').select('full_name').eq('id', actor.userId).maybeSingle();
      const acName = acUserRow?.full_name || actor.userId || 'Unknown AC';

      // Auto-create a dummy lead to hold the source information
      // Since student is tied to a lead
      const { data: leadModel, error: leadErr } = await adminClient.from('leads').insert({
        student_name: payload.student_name,
        parent_name: payload.parent_name || null,
        country_code: payload.country_code || null,
        country: payload.country || null,
        contact_number: payload.contact_number || null,
        class_level: payload.class_level || null,
        package_name: payload.package_name || null,
        source: 'AC Direct Onboarding',
        current_note: `Manually added by: ${acName}`,
        owner_stage: 'finance',
        status: 'payment_verification'
      }).select('id').single();

      if (leadErr) throw new Error(`Lead creation failed: ${leadErr.message}`);

      // Create a payment request for finance to verify
      const { data: paymentReq, error: reqErr } = await adminClient.from('payment_requests').insert({
        lead_id: leadModel.id,
        requested_by: actor.userId,
        amount: Number(payload.onboarding_paid) || 0,
        total_amount: Number(payload.onboarding_fee) || 0,
        hours: Number(payload.hours) || 0,
        screenshot_url: payload.screenshot_url || null,
        status: 'pending'
      }).select('*').single();

      if (reqErr) {
        await adminClient.from('leads').delete().eq('id', leadModel.id);
        throw new Error(`Payment request creation failed: ${reqErr.message}`);
      }

      sendJson(res, 201, { ok: true, msg: 'Onboarding payment request submitted to Finance.' });
      return true;
    }

    // ─── GET /students/sessions/today ──────────────────────
    if (req.method === 'GET' && url.pathname === '/students/sessions/today') {
      if (!['academic_coordinator', 'teacher', 'finance', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'session access is not allowed for this role' });
        return true;
      }
      const offsetParam = url.searchParams.get('offset') || '0';
      const offset = parseInt(offsetParam, 10);

      const nowRaw = new Date();
      const istStr = nowRaw.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      const now = new Date(istStr);
      now.setDate(now.getDate() + offset);

      const pad = n => String(n).padStart(2, '0');
      const targetDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      let query = adminClient
        .from('academic_sessions')
        .select(`
            *, 
            students!inner(student_code,student_name,class_level,academic_coordinator_id), 
            users!academic_sessions_teacher_id_fkey(id,full_name,email), 
            session_verifications(id,type,status,new_duration,reason,created_at)
        `)
        .eq('session_date', targetDate)
        .order('started_at', { ascending: true })
        .order('created_at', { foreignTable: 'session_verifications', ascending: false });

      const requestedUserId = url.searchParams.get('user_id');
      if (actor.role === 'teacher') {
        query = query.eq('teacher_id', actor.userId);
      } else if (isAC(actor)) {
        query = query.eq('students.academic_coordinator_id', actor.userId);
      } else if (actor.role === 'super_admin' && requestedUserId) {
        query = query.eq('students.academic_coordinator_id', requestedUserId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true, items: (data || []).map(s => ({ ...s, verification_status: verificationStatusOf(s) })) });
      return true;
    }

    // ─── GET /students/sessions/history ────────────────────
    if (req.method === 'GET' && url.pathname === '/students/sessions/history') {
      if (!['academic_coordinator', 'teacher', 'finance', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'session access is not allowed for this role' });
        return true;
      }
      let query = adminClient
        .from('academic_sessions')
        .select(`
            *, 
            students(student_code,student_name), 
            users!academic_sessions_teacher_id_fkey(id,full_name,email), 
            session_verifications(id,type,status,reason,new_duration,verified_at,created_at)
        `)
        .order('session_date', { ascending: false })
        .order('created_at', { foreignTable: 'session_verifications', ascending: false })
        .limit(2000);

      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      if (from && to) {
        query = query.gte('session_date', from).lte('session_date', to);
      }

      if (actor.role === 'teacher') query = query.eq('teacher_id', actor.userId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true, items: (data || []).map(s => ({ ...s, verification_status: verificationStatusOf(s) })) });
      return true;
    }

    // ─── GET /students/sessions/week ───────────────────────
    if (req.method === 'GET' && url.pathname === '/students/sessions/week') {
      if (!['academic_coordinator', 'teacher', 'finance', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'session access is not allowed for this role' });
        return true;
      }
      const offsetParam = url.searchParams.get('offset') || '0';
      const offset = parseInt(offsetParam, 10);

      // 1. Get current time in correct locale timezone (Asia/Kolkata)
      const nowRaw = new Date();
      const istStr = nowRaw.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      const now = new Date(istStr);

      const dayOfWeek = now.getDay() || 7; // Convert 0 (Sunday) to 7
      const mondayOffset = dayOfWeek - 1; // Days to subtract to reach Monday

      const monday = new Date(now);
      monday.setDate(now.getDate() - mondayOffset + offset * 7);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      // Convert specifically referencing local year/month/date manually to avoid standard ISO conversion shifting back to UTC
      const pad = n => String(n).padStart(2, '0');
      const startDate = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
      const endDate = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;

      let query = adminClient
        .from('academic_sessions')
        .select('*, students!inner(student_code,student_name,academic_coordinator_id), users!academic_sessions_teacher_id_fkey(id,full_name), session_verifications(id,type,status)')
        .gte('session_date', startDate)
        .lte('session_date', endDate)
        .order('session_date', { ascending: true })
        .order('started_at', { ascending: true });

      const requestedUserId = url.searchParams.get('user_id');
      if (actor.role === 'teacher') {
        query = query.eq('teacher_id', actor.userId);
      } else if (isAC(actor)) {
        query = query.eq('students.academic_coordinator_id', actor.userId);
      } else if (actor.role === 'super_admin' && requestedUserId) {
        query = query.eq('students.academic_coordinator_id', requestedUserId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true, items: (data || []).map(s => ({ ...s, verification_status: verificationStatusOf(s) })), weekStart: startDate, weekEnd: endDate });
      return true;
    }

    // ─── GET /students/coordinators ──────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === '/students/coordinators') {
      if (!['super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'only super admin can list coordinators' });
        return true;
      }
      const { data, error } = await adminClient
        .from('user_roles')
        .select('user_id, roles!inner(code), users!inner(full_name, email)')
        .eq('roles.code', 'academic_coordinator');
        
      if (error) throw new Error(error.message);
      
      const items = (data || []).map(r => ({
        id: r.user_id,
        full_name: r.users?.full_name || 'Unknown',
        email: r.users?.email || ''
      })).sort((a, b) => a.full_name.localeCompare(b.full_name));

      sendJson(res, 200, { ok: true, items });
      return true;
    }

    // ─── GET /students/teacher-availability ─────────────────
    if (req.method === 'GET' && url.pathname === '/students/teacher-availability') {
      if (!['academic_coordinator', 'teacher_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'availability access is not allowed for this role' });
        return true;
      }
      const { data, error } = await adminClient
        .from('teacher_profiles')
        .select('teacher_code, user_id, users(id,full_name), teacher_availability(day_of_week,start_time,end_time)')
        .eq('is_in_pool', true)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      const items = (data || []).map((row) => {
        const slotCount = (row.teacher_availability || []).length;
        const utilization = Math.min(95, slotCount * 12 + 15);
        return {
          teacher_code: row.teacher_code,
          teacher_name: row.users?.full_name || row.user_id,
          user_id: row.user_id,
          utilization,
          slot_count: slotCount
        };
      });
      sendJson(res, 200, { ok: true, items });
      return true;
    }

    // ─── GET /students/topup-requests ───────────────────────
    if (req.method === 'GET' && url.pathname === '/students/topup-requests') {
      if (!['academic_coordinator', 'finance', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'top-up access is not allowed for this role' });
        return true;
      }
      const status = url.searchParams.get('status') || 'all';
      let query = adminClient
        .from('student_topups')
        .select('*, students!inner(student_code,student_name,contact_number,academic_coordinator_id)')
        .order('created_at', { ascending: false });
      if (status !== 'all') query = query.eq('status', status);

      const requestedUserId = url.searchParams.get('user_id');
      if (isAC(actor)) {
        query = query.eq('students.academic_coordinator_id', actor.userId);
      } else if (actor.role === 'super_admin' && requestedUserId) {
        query = query.eq('students.academic_coordinator_id', requestedUserId);
      }

      const fromParam = url.searchParams.get('from');
      const toParam = url.searchParams.get('to');
      if (fromParam && toParam) {
        query = query.gte('created_at', fromParam.includes('T') ? fromParam : fromParam + 'T00:00:00+05:30')
                     .lte('created_at', toParam.includes('T') ? toParam : toParam + 'T23:59:59+05:30');
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true, items: data || [] });
      return true;
    }

    // ─── GET /students/:id/sessions/verified ────────────────
    if (req.method === 'GET' && parts.length === 4 && parts[0] === 'students' && parts[2] === 'sessions' && parts[3] === 'verified') {
      if (!canViewStudents(actor)) {
        sendJson(res, 403, { ok: false, error: 'session access is not allowed' });
        return true;
      }
      const studentId = parts[1];
      const { data, error } = await adminClient
        .from('academic_sessions')
        .select('*, users!academic_sessions_teacher_id_fkey(id,full_name), session_verifications!inner(status)')
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .eq('session_verifications.status', 'approved')
        .order('session_date', { ascending: false })
        .order('started_at', { ascending: false });

      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true, items: (data || []).map(s => ({ ...s, verification_status: 'approved' })) });
      return true;
    }

    // ─── GET /students/:id ──────────────────────────────────
    if (req.method === 'GET' && parts.length === 2 && parts[0] === 'students') {
      if (!canViewStudents(actor)) {
        sendJson(res, 403, { ok: false, error: 'student access is not allowed for this role' });
        return true;
      }
      const studentId = parts[1];
      const { data, error } = await adminClient
        .from('students')
        .select('*, leads!students_lead_id_fkey(*, counselors:users!leads_counselor_id_fkey(id, full_name))')
        .eq('id', studentId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        sendJson(res, 404, { ok: false, error: 'student not found' });
        return true;
      }

      // Fetch assignments
      const { data: assignments } = await adminClient
        .from('student_teacher_assignments')
        .select('*, users!student_teacher_assignments_teacher_id_fkey(id, full_name, email)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      // Fetch recent sessions
      const { data: sessions } = await adminClient
        .from('academic_sessions')
        .select('*, users!academic_sessions_teacher_id_fkey(id,full_name), session_verifications(status)')
        .eq('student_id', studentId)
        .order('session_date', { ascending: false })
        .limit(2000);

      // Fetch messages
      const { data: messages } = await adminClient
        .from('student_messages')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(2000);

      let demoSessions = [];
      let paymentRequests = [];
      let topupRequests = [];

      // Always fetch topups by student id
      const { data: topups } = await adminClient
        .from('student_topups')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (topups) topupRequests = topups;

      // Fetch demo sessions — the demo_sessions table only has lead_id (no student_id column)
      if (data.lead_id) {
        const { data: ds, error: dsError } = await adminClient
          .from('demo_sessions')
          .select('*, users!demo_sessions_teacher_id_fkey(id, full_name)')
          .eq('lead_id', data.lead_id)
          .order('scheduled_at', { ascending: false });
        if (!dsError && ds) demoSessions = ds;

        // Fetch payment requests
        const { data: pr } = await adminClient
          .from('payment_requests')
          .select('*')
          .eq('lead_id', data.lead_id)
          .order('created_at', { ascending: false });
        if (pr) paymentRequests = pr;
      }

      sendJson(res, 200, {
        ok: true,
        student: data,
        assignments: assignments || [],
        sessions: (sessions || []).map(s => ({ ...s, verification_status: verificationStatusOf(s) })),
        messages: messages || [],
        demoSessions,
        paymentRequests,
        topupRequests
      });
      return true;
    }

    // ─── POST /students/:id/messages/send-reminder ──────────
    const srMatch = url.pathname.match(/^\/students\/([^\/]+)\/messages\/send-reminder$/);
    if (req.method === 'POST' && srMatch) {
      if (!isAC(actor) && actor.role !== 'super_admin') {
        sendJson(res, 403, { ok: false, error: 'only ac and admin can send reminders' });
        return true;
      }
      const studentId = srMatch[1];
      const { data: st } = await adminClient.from('students').select('student_name, contact_number, alternative_number, parent_phone').eq('id', studentId).maybeSingle();
      if (!st) {
        sendJson(res, 404, { ok: false, error: 'student not found' });
        return true;
      }

      const phoneRaw = st.contact_number || st.alternative_number || st.parent_phone;
      if (!phoneRaw) {
        sendJson(res, 400, { ok: false, error: 'student has no phone number on record' });
        return true;
      }
      const phone = phoneRaw.replace(/[^0-9]/g, '');

      const rawBody = await readJson(req).catch(() => ({}));
      const body = validatePayload(res, sendReminderSchema, rawBody);
      if (!body) return true;
      const text = body.text || `Hello ${st.student_name}, this is a gentle reminder regarding your upcoming classes.`;

      const { data: sessRow } = await adminClient.from('whatsapp_sessions').select('session_name, api_key').eq('status', 'WORKING').eq('user_id', actor.userId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (!sessRow) {
        sendJson(res, 500, { ok: false, error: 'No active WhatsApp session found' });
        return true;
      }

      const waappaUrl = process.env.WAAPPA_BASE_URL || 'http://localhost:3001';
      const sendRes = await fetch(`${waappaUrl}/api/sendText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': sessRow.api_key, 'Accept': 'application/json' },
        body: JSON.stringify({ session: sessRow.session_name, chatId: `${phone}@c.us`, text })
      });
      if (!sendRes.ok) {
        const errText = await sendRes.text();
        sendJson(res, 500, { ok: false, error: `Waappa send failed: ${errText}` });
        return true;
      }

      sendJson(res, 200, { ok: true, message: 'Reminder sent via WhatsApp' });
      return true;
    }

    // ─── POST /students/:id/whatsapp-group ──────────────────
    const waGroupMatch = url.pathname.match(/^\/students\/([^\/]+)\/whatsapp-group$/);
    if (req.method === 'POST' && waGroupMatch) {
      if (!isAC(actor) && actor.role !== 'super_admin') {
        sendJson(res, 403, { ok: false, error: 'only ac and admin can create groups' });
        return true;
      }
      const studentId = waGroupMatch[1];

      const { data: st, error: stErr } = await adminClient
        .from('students')
        .select('student_name, contact_number, alternative_number, parent_phone, group_jid')
        .eq('id', studentId)
        .maybeSingle();

      if (stErr || !st) {
        sendJson(res, 404, { ok: false, error: 'student not found' });
        return true;
      }
      if (st.group_jid) {
        sendJson(res, 400, { ok: false, error: 'group already exists' });
        return true;
      }

      const { data: sessRow } = await adminClient
        .from('whatsapp_sessions')
        .select('session_name, api_key, connected_phone')
        .eq('status', 'WORKING')
        .eq('user_id', actor.userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sessRow || !sessRow.api_key) {
        sendJson(res, 500, { ok: false, error: 'No active WhatsApp session found' });
        return true;
      }

      const session = sessRow.session_name;
      const apiKey = sessRow.api_key;

      const phones = [st.contact_number, st.alternative_number, st.parent_phone]
        .filter(Boolean)
        .map(p => {
          const hasPlus = p.trim().startsWith('+');
          let num = p.replace(/[^0-9]/g, '');
          // If starting with 0, remove it
          if (num.startsWith('0') && num.length === 11) num = num.substring(1);
          // If 10 digits and NO '+', assume India (+91)
          if (!hasPlus && num.length === 10) num = `91${num}`;
          return num;
        })
        .filter(p => p.length >= 9);

      const uniquePhones = [...new Set(phones)].map(p => ({ id: `${p}@c.us` }));
      if (uniquePhones.length === 0) {
        sendJson(res, 400, { ok: false, error: 'No valid phone numbers to add' });
        return true;
      }

      const rawBody = await readJson(req).catch(() => ({}));
      const body = validatePayload(res, whatsappGroupSchema, rawBody);
      if (!body) return true;
      const groupName = body.name || (st.student_name ? `Edusolve - ${st.student_name}` : 'Edusolve Group');

      const waappaUrl = process.env.WAAPPA_BASE_URL || 'http://localhost:3001';

      const payload = {
        name: groupName,
        participants: uniquePhones
      };

      const response = await fetch(`${waappaUrl}/api/${session}/groups`, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        sendJson(res, 500, { ok: false, error: `Waappa error: ${response.status} ${errText}` });
        return true;
      }

      const groupInfo = await response.json();

      let jid = groupInfo.JID || groupInfo.id || groupInfo.group_id;
      if (!jid && Array.isArray(groupInfo) && groupInfo.length > 0) {
        jid = groupInfo[0].JID || groupInfo[0].id;
      }

      if (!jid) {
        sendJson(res, 500, { ok: false, error: 'Waappa returned missing JID' });
        return true;
      }

      const { error: updateErr } = await adminClient
        .from('students')
        .update({ group_jid: jid, group_name: groupName })
        .eq('id', studentId);

      if (updateErr) {
        sendJson(res, 500, { ok: false, error: updateErr.message });
        return true;
      }

      sendJson(res, 200, { ok: true, group_jid: jid, group_name: groupName });
      return true;
    }

    // ─── PUT /students/:id ──────────────────────────────────
    if (req.method === 'PUT' && parts.length === 2 && parts[0] === 'students') {
      if (!isAC(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can edit student details' });
        return true;
      }
      const studentId = parts[1];
      const rawBody = await readJson(req);
      const updateFields = validatePayload(res, updateStudentSchema, rawBody);
      if (!updateFields) return true;

      if (Object.keys(updateFields).length === 0) {
        sendJson(res, 400, { ok: false, error: 'no valid fields to update' });
        return true;
      }

      updateFields.updated_at = nowIso();

      const { data, error } = await adminClient
        .from('students')
        .update(updateFields)
        .eq('id', studentId)
        .is('deleted_at', null)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      if (!data) {
        sendJson(res, 404, { ok: false, error: 'student not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, student: data });
      return true;
    }

    // ─── PATCH /students/:id/status ─────────────────────────
    if (req.method === 'PATCH' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'status') {
      if (!isAC(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can change student status' });
        return true;
      }
      const studentId = parts[1];
      const rawBody = await readJson(req);
      const payload = validatePayload(res, studentStatusSchema, rawBody);
      if (!payload) return true;
      const { data, error } = await adminClient
        .from('students')
        .update({ status: payload.status, updated_at: nowIso() })
        .eq('id', studentId)
        .is('deleted_at', null)
        .select('id, status')
        .single();
      if (error) throw new Error(error.message);
      if (!data) {
        sendJson(res, 404, { ok: false, error: 'student not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, student: data });
      return true;
    }

    // ─── PATCH /students/:id/coordinator ─────────────────────────
    if (req.method === 'PATCH' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'coordinator') {
      if (actor.role !== 'super_admin') {
        sendJson(res, 403, { ok: false, error: 'only super admin can reassign academic coordinators' });
        return true;
      }
      const studentId = parts[1];
      const rawBody = await readJson(req);
      const payload = validatePayload(res, reassignACSchema, rawBody);
      if (!payload) return true;
      const { data, error } = await adminClient
        .from('students')
        .update({ academic_coordinator_id: payload.academic_coordinator_id, updated_at: nowIso() })
        .eq('id', studentId)
        .is('deleted_at', null)
        .select('id, academic_coordinator_id')
        .single();
      if (error) throw new Error(error.message);
      if (!data) {
        sendJson(res, 404, { ok: false, error: 'student not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, student: data });
      return true;
    }

    // ─── GET /students/:student_id/availability ─────────────
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'availability') {
      const studentId = parts[1];
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');

      if (!startDate || !endDate) {
        sendJson(res, 400, { ok: false, error: 'start_date and end_date required' });
        return true;
      }

      // Get booked classes within range for this student
      const { data: classes, error: cErr } = await adminClient
        .from('academic_sessions')
        .select('session_date, started_at, duration_hours')
        .eq('student_id', studentId)
        .gte('session_date', startDate)
        .lte('session_date', endDate)
        .in('status', ['completed', 'rescheduled', 'scheduled']);

      if (cErr) throw new Error(cErr.message);

      sendJson(res, 200, { ok: true, classes: classes || [] });
      return true;
    }

    // ─── GET /students/:id/assignments ──────────────────────
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'assignments') {
      if (!canViewStudents(actor)) {
        sendJson(res, 403, { ok: false, error: 'not allowed' });
        return true;
      }
      const studentId = parts[1];
      const { data, error } = await adminClient
        .from('student_teacher_assignments')
        .select('*, users!student_teacher_assignments_teacher_id_fkey(id, full_name, email)')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true, items: data || [] });
      return true;
    }

    // ─── POST /students/:id/assignments ─────────────────────
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'assignments') {
      if (!isAC(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can assign teachers' });
        return true;
      }
      const studentId = parts[1];
      const rawBody = await readJson(req);
      const payload = validatePayload(res, createAssignmentSchema, rawBody);
      if (!payload) return true;
      const { data, error } = await adminClient
        .from('student_teacher_assignments')
        .insert({
          student_id: studentId,
          teacher_id: payload.teacher_id,
          subject: payload.subject,
          day: payload.day || null,
          time: payload.time || null,
          schedule_note: payload.schedule_note || null,
          status: 'pending',
          is_active: false,
          assigned_by: actor.userId,
          updated_at: nowIso()
        })
        .select('*, users!student_teacher_assignments_teacher_id_fkey(id, full_name)')
        .single();
      if (error) throw new Error(error.message);
      sendJson(res, 201, { ok: true, assignment: data });
      return true;
    }

    // ─── POST /students/:id/assignments/:aid/accept ──────────
    if (req.method === 'POST' && parts.length === 5 && parts[0] === 'students' && parts[2] === 'assignments' && parts[4] === 'accept') {
      if (!isAC(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can accept assignments' });
        return true;
      }
      const studentId = parts[1];
      const assignmentId = parts[3];

      // 1. Get the assignment to know the subject
      const { data: assignment, error: err1 } = await adminClient
        .from('student_teacher_assignments')
        .select('subject, status')
        .eq('id', assignmentId)
        .eq('student_id', studentId)
        .single();
      if (err1) { sendJson(res, 404, { ok: false, error: 'Assignment not found' }); return true; }
      if (assignment.status === 'accepted') { sendJson(res, 400, { ok: false, error: 'Already accepted' }); return true; }

      // 2. Mark this one as accepted and active
      const { data: updated, error: err2 } = await adminClient
        .from('student_teacher_assignments')
        .update({ status: 'accepted', is_active: true, updated_at: nowIso() })
        .eq('id', assignmentId)
        .select()
        .single();
      if (err2) throw new Error(err2.message);

      // 3. Delete any other 'pending' assignments for the SAME subject and student
      await adminClient
        .from('student_teacher_assignments')
        .delete()
        .eq('student_id', studentId)
        .eq('subject', assignment.subject)
        .eq('status', 'pending');

      sendJson(res, 200, { ok: true, assignment: updated });
      return true;
    }

    // ─── DELETE /students/:id/assignments/:aid ──────────────
    if (req.method === 'DELETE' && parts.length === 4 && parts[0] === 'students' && parts[2] === 'assignments') {
      if (!isAC(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can remove assignments' });
        return true;
      }
      const assignmentId = parts[3];
      const { error } = await adminClient
        .from('student_teacher_assignments')
        .update({ is_active: false, updated_at: nowIso() })
        .eq('id', assignmentId);
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true });
      return true;
    }

    // ─── POST /students/:id/sessions ────────────────────────
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'sessions') {
      if (!isAC(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can schedule sessions' });
        return true;
      }
      const studentId = parts[1];
      const rawBody = await readJson(req);
      const payload = validatePayload(res, createSessionSchema, rawBody);
      if (!payload) return true;
      const { data, error } = await adminClient
        .from('academic_sessions')
        .insert({
          student_id: studentId,
          teacher_id: payload.teacher_id,
          session_date: payload.session_date,
          started_at: payload.started_at ? `${payload.session_date}T${payload.started_at}:00+05:30` : null,
          ended_at: payload.ended_at ? `${payload.session_date}T${payload.ended_at}:00+05:30` : null,
          duration_hours: Number(payload.duration_hours),
          subject: payload.subject || null,
          status: 'completed',
          homework: payload.homework || null,
          marks: payload.marks || null,
          created_at: nowIso()
        })
        .select('*, students(student_code,student_name), users!academic_sessions_teacher_id_fkey(id,full_name)')
        .single();
      if (error) throw new Error(error.message);

      // Auto-upsert student_teacher_assignments so assignment roster stays in sync
      if (payload.subject && payload.teacher_id) {
        await adminClient
          .from('student_teacher_assignments')
          .upsert({
            student_id: studentId,
            teacher_id: payload.teacher_id,
            subject: payload.subject,
            is_active: true,
            status: 'accepted',
            assigned_by: actor.userId,
            updated_at: nowIso()
          }, { onConflict: 'student_id,teacher_id,subject', ignoreDuplicates: true });
      }

      sendJson(res, 201, { ok: true, session: data });
      return true;
    }

    // ─── POST /students/:id/sessions/bulk ───────────────────
    if (req.method === 'POST' && parts.length === 4 && parts[0] === 'students' && parts[2] === 'sessions' && parts[3] === 'bulk') {
      if (!isAC(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can schedule classes' });
        return true;
      }
      const studentId = parts[1];
      const rawBody = await readJson(req);
      const payload = validatePayload(res, bulkSessionSchema, rawBody);
      if (!payload) return true;
      const { teacher_id, start_date, end_date, days_of_week, started_at, duration_hours, subject } = payload;

      const start = new Date(`${start_date}T00:00:00Z`);
      const end = new Date(`${end_date}T00:00:00Z`);
      const DAY_MAP = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // Collect all target dates
      const targetDates = [];
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dayName = DAY_MAP[d.getUTCDay()];
        if (days_of_week.includes(dayName)) {
          targetDates.push(d.toISOString().split('T')[0]);
        }
      }

      if (targetDates.length === 0) {
        sendJson(res, 400, { ok: false, error: 'no valid dates found in range' });
        return true;
      }

      // Parse proposed session time window (in minutes, IST = UTC+5:30)
      const [sH, sM] = started_at.split(':').map(Number);
      const newStartMins = sH * 60 + sM;
      const newEndMins = newStartMins + Number(duration_hours) * 60;

      // Fetch existing sessions and demos for teacher and student in the date range
      const [teacherSessRes, studentSessRes, teacherDemoRes] = await Promise.all([
        adminClient
          .from('academic_sessions')
          .select('session_date, started_at, duration_hours, students(student_name)')
          .eq('teacher_id', teacher_id)
          .gte('session_date', start_date)
          .lte('session_date', end_date)
          .not('started_at', 'is', null),
        adminClient
          .from('academic_sessions')
          .select('session_date, started_at, duration_hours, users!academic_sessions_teacher_id_fkey(full_name)')
          .eq('student_id', studentId)
          .gte('session_date', start_date)
          .lte('session_date', end_date)
          .not('started_at', 'is', null),
        adminClient
          .from('demo_sessions')
          .select('scheduled_at, ends_at, student_name')
          .eq('teacher_id', teacher_id)
          .gte('scheduled_at', `${start_date}T00:00:00.000Z`)
          .lte('scheduled_at', `${end_date}T23:59:59.999Z`)
      ]);

      const teacherSessions = teacherSessRes.data || [];
      const studentSessions = studentSessRes.data || [];
      const teacherDemos = teacherDemoRes.data || [];

      function toMins(timeStr) {
        // timeStr can be ISO like "2026-03-18T10:00:00+05:30" or "HH:MM"
        if (timeStr.includes('T')) {
          const istStr = new Date(timeStr).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
          const [h, m] = istStr.split(':').map(Number);
          return h * 60 + m;
        }
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      }

      function hasOverlap(sessions, dateStr) {
        return sessions.find(s => {
          if (s.session_date !== dateStr) return false;
          const existStart = toMins(s.started_at);
          const existEnd = existStart + Number(s.duration_hours || 1) * 60;
          return newStartMins < existEnd && newEndMins > existStart;
        });
      }

      // Separate conflicted vs clean dates
      const conflicts = [];
      const sessionRecords = [];

      for (const dateStr of targetDates) {
        let teacherConflict = hasOverlap(teacherSessions, dateStr);
        
        // If no class conflict, check for demo conflict
        if (!teacherConflict) {
          const demoMatch = teacherDemos.find(d => {
            const dDate = new Date(d.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            if (dDate !== dateStr) return false;
            
            const dStart = toMins(d.scheduled_at);
            const dEnd = d.ends_at ? toMins(d.ends_at) : dStart + 60;
            return newStartMins < dEnd && newEndMins > dStart;
          });
          if (demoMatch) {
            teacherConflict = { students: { student_name: `Demo with ${demoMatch.student_name || 'Prospect'}` } };
          }
        }

        const studentConflict = !teacherConflict && hasOverlap(studentSessions, dateStr);

        if (teacherConflict) {
          conflicts.push({
            date: dateStr,
            reason: 'teacher',
            conflict_with: teacherConflict.students?.student_name || 'another student'
          });
        } else if (studentConflict) {
          conflicts.push({
            date: dateStr,
            reason: 'student',
            conflict_with: studentConflict.users?.full_name || 'another teacher'
          });
        } else {
          sessionRecords.push({
            student_id: studentId,
            teacher_id: teacher_id,
            session_date: dateStr,
            started_at: `${dateStr}T${started_at}:00+05:30`,
            duration_hours: Number(duration_hours),
            subject: subject || null,
            status: 'scheduled',
            created_at: nowIso()
          });
        }
      }

      const { data, error } = await adminClient
        .from('academic_sessions')
        .insert(sessionRecords)
        .select('*');

      if (error) throw new Error(error.message);

      // Auto-upsert student_teacher_assignments so assignment roster stays in sync
      if (subject && teacher_id) {
        await adminClient
          .from('student_teacher_assignments')
          .upsert({
            student_id: studentId,
            teacher_id: teacher_id,
            subject: subject,
            is_active: true,
            status: 'accepted',
            assigned_by: actor.userId,
            updated_at: nowIso()
          }, { onConflict: 'student_id,teacher_id,subject', ignoreDuplicates: true });
      }

      // ── n8n Webhook: notify if any sessions are for today (fire-and-forget) ──
      notifyBulkScheduledToday(data, {
        studentId,
        teacherId: teacher_id,
        subject: subject || null,
        scheduledBy: actor.userId
      }).catch(err => console.error('[n8n-webhook] bulk notify error:', err.message));

      sendJson(res, 201, { ok: true, count: data.length });
      return true;
    }

    // ─── PUT /students/sessions/:id/reschedule ──────────────
    if (req.method === 'PUT' && parts.length === 4 && parts[0] === 'students' && parts[1] === 'sessions' && parts[3] === 'reschedule') {
      if (!isAC(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can reschedule' });
        return true;
      }
      const sessionId = parts[2];
      const rawBody = await readJson(req);
      const updateFields = validatePayload(res, rescheduleSessionSchema, rawBody);
      if (!updateFields) return true;

      // Fetch old session BEFORE update (for webhook old/new comparison)
      const { data: oldSession } = await adminClient
        .from('academic_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (updateFields.session_date && updateFields.started_at && !updateFields.started_at.includes('T')) {
        updateFields.started_at = `${updateFields.session_date}T${updateFields.started_at}:00+05:30`;
      }

      // Auto-set the status to rescheduled
      updateFields.status = 'rescheduled';

      if (Object.keys(updateFields).length === 0) {
        sendJson(res, 400, { ok: false, error: 'no fields to update' });
        return true;
      }
      const { data, error } = await adminClient
        .from('academic_sessions')
        .update(updateFields)
        .eq('id', sessionId)
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      // ── n8n Webhook: notify reschedule with old + new details (fire-and-forget) ──
      if (oldSession) {
        notifySessionRescheduled(oldSession, updateFields, {
          rescheduledBy: actor.userId
        }).catch(err => console.error('[n8n-webhook] reschedule notify error:', err.message));
      }

      sendJson(res, 200, { ok: true, session: data });
      return true;
    }

    // ─── GET /students/:id/messages ─────────────────────────
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'messages') {
      if (!canViewStudents(actor)) {
        sendJson(res, 403, { ok: false, error: 'not allowed' });
        return true;
      }
      const studentId = parts[1];
      const { data, error } = await adminClient
        .from('student_messages')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: true })
        .limit(2000);
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true, items: data || [] });
      return true;
    }

    // ─── POST /students/:id/messages/send-reminder ──────────
    if (req.method === 'POST' && parts.length === 4 && parts[0] === 'students' && parts[2] === 'messages' && parts[3] === 'send-reminder') {
      if (!isAC(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can send reminders' });
        return true;
      }
      const studentId = parts[1];
      const rawBody = await readJson(req);
      const payload = validatePayload(res, messageReminderSchema, rawBody);
      if (!payload) return true;
      const messageContent = payload.message || 'Session reminder: You have an upcoming class today.';

      // Fetch student for contact number
      const { data: student } = await adminClient
        .from('students')
        .select('student_name, contact_number, parent_name')
        .eq('id', studentId)
        .maybeSingle();

      // Log the message
      const { data: msg, error: msgError } = await adminClient
        .from('student_messages')
        .insert({
          student_id: studentId,
          sent_by: actor.userId,
          direction: 'outgoing',
          channel: 'whatsapp',
          message_type: payload.type || 'reminder',
          content: messageContent,
          delivery_status: 'sent',
          metadata: {
            session_id: payload.session_id || null,
            contact_number: student?.contact_number || null,
            student_name: student?.student_name || null
          },
          created_at: nowIso()
        })
        .select('*')
        .single();
      if (msgError) throw new Error(msgError.message);

      // TODO: In production, call n8n webhook here for actual WhatsApp delivery
      // const webhookUrl = process.env.N8N_REMINDER_WEBHOOK;
      // if (webhookUrl) { await fetch(webhookUrl, { method: 'POST', body: JSON.stringify({ ... }) }); }

      sendJson(res, 201, { ok: true, message: msg });
      return true;
    }

    // ─── POST /students/:id/topup-requests ──────────────────
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'topup-requests') {
      if (!canRequestTopup(actor)) {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator can request top-up' });
        return true;
      }
      const studentId = parts[1];
      const rawBody = await readJson(req);
      const payload = validatePayload(res, topupSchema, rawBody);
      if (!payload) return true;

      const hoursAdded = payload.hours_added;
      const totalAmount = payload.total_amount;
      const amount = payload.amount;
      const { data: student, error: studentError } = await adminClient
        .from('students')
        .select('id')
        .eq('id', studentId)
        .maybeSingle();
      if (studentError) throw new Error(studentError.message);
      if (!student) {
        sendJson(res, 404, { ok: false, error: 'student not found' });
        return true;
      }
      const { data, error } = await adminClient
        .from('student_topups')
        .insert({
          student_id: studentId,
          hours_added: hoursAdded,
          total_amount: totalAmount,
          amount,
          finance_note: payload.finance_note || null,
          payment_verified: false,
          status: 'pending_finance',
          screenshot_url: payload.screenshot_url || null,
          requested_by: actor.userId,
          created_at: nowIso()
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      sendJson(res, 201, { ok: true, topup: data });
      return true;
    }

    // ─── PUT /students/topup-requests/:id ───────────────────
    if (req.method === 'PUT' && parts.length === 3 && parts[0] === 'students' && parts[1] === 'topup-requests') {
      const topupId = parts[2];
      const payload = await readJson(req);

      const { data: request, error: fetchErr } = await adminClient
        .from('student_topups')
        .select('*')
        .eq('id', topupId)
        .maybeSingle();

      if (fetchErr || !request) {
        sendJson(res, 404, { ok: false, error: 'Top-up request not found' });
        return true;
      }

      if (request.status !== 'pending' && request.status !== 'pending_finance') {
        sendJson(res, 400, { ok: false, error: 'Only pending requests can be modified' });
        return true;
      }

      if (request.requested_by !== actor.userId && !['academic_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'You are not allowed to modify this request' });
        return true;
      }

      const updates = {};
      if (payload.amount !== undefined) updates.amount = payload.amount;
      if (payload.total_amount !== undefined) updates.total_amount = payload.total_amount || null;
      if (payload.hours_added !== undefined) updates.hours_added = payload.hours_added;
      if (payload.screenshot_url !== undefined) updates.screenshot_url = payload.screenshot_url || null;
      if (payload.finance_note !== undefined) updates.finance_note = payload.finance_note || null;

      const { data: updated, error: updateErr } = await adminClient
        .from('student_topups')
        .update(updates)
        .eq('id', topupId)
        .select('*')
        .single();

      if (updateErr) throw new Error(updateErr.message);

      sendJson(res, 200, { ok: true, request: updated });
      return true;
    }

    // ─── DELETE /students/topup-requests/:id ────────────────
    if (req.method === 'DELETE' && parts.length === 3 && parts[0] === 'students' && parts[1] === 'topup-requests') {
      const topupId = parts[2];

      const { data: request, error: fetchErr } = await adminClient
        .from('student_topups')
        .select('*')
        .eq('id', topupId)
        .maybeSingle();

      if (fetchErr || !request) {
        sendJson(res, 404, { ok: false, error: 'Top-up request not found' });
        return true;
      }

      if (request.status !== 'pending' && request.status !== 'pending_finance') {
        sendJson(res, 400, { ok: false, error: 'Only pending requests can be deleted' });
        return true;
      }

      if (request.requested_by !== actor.userId && !['academic_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'You are not allowed to delete this request' });
        return true;
      }

      const { error: deleteErr } = await adminClient
        .from('student_topups')
        .delete()
        .eq('id', topupId);

      if (deleteErr) throw new Error(deleteErr.message);

      sendJson(res, 200, { ok: true });
      return true;
    }

    // ─── GET /academic/material-transfers ──────────────────
    if (req.method === 'GET' && parts.length === 2 && parts[0] === 'academic' && parts[1] === 'material-transfers') {
      if (!['academic_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'User does not have permission' });
        return true;
      }

      let query = adminClient.from('material_transfers').select('*, students(student_name), users!material_transfers_teacher_id_fkey(full_name)').order('created_at', { ascending: false });

      if (actor.role === 'academic_coordinator') {
        query = query.eq('ac_id', actor.userId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      sendJson(res, 200, { ok: true, items: data || [] });
      return true;
    }

    // ─── POST /academic/material-transfers/:id/retry ───────
    if (req.method === 'POST' && parts.length === 4 && parts[0] === 'academic' && parts[1] === 'material-transfers' && parts[3] === 'retry') {
      if (!['academic_coordinator', 'super_admin'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'User does not have permission' });
        return true;
      }

      const transferId = parts[2];
      const { data: transfer, error: tErr } = await adminClient
        .from('material_transfers')
        .select('*, students(group_jid, student_name)')
        .eq('id', transferId)
        .maybeSingle();

      if (tErr || !transfer) {
        sendJson(res, 404, { ok: false, error: 'Transfer record not found' });
        return true;
      }

      if (actor.role === 'academic_coordinator' && transfer.ac_id !== actor.userId) {
        sendJson(res, 403, { ok: false, error: 'You do not own this transfer' });
        return true;
      }

      const { data: acSession } = await adminClient
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', transfer.ac_id)
        .eq('status', 'WORKING')
        .maybeSingle();

      const theSessionName = acSession?.session_name;
      if (!theSessionName) {
        sendJson(res, 400, { ok: false, error: 'Your WhatsApp session is still offline. Please connect device first.' });
        return true;
      }

      // Retry Logic Waappa Construct
      const WAAPPA_BASE = process.env.WAAPPA_BASE_URL || 'http://main.waappa.com';
      // Use the AC session's own api_key for proper auth
      const WAAPPA_KEY = acSession.api_key || process.env.WAAPPA_API_KEY || 'yoursecretkey';

      // Normalise group JID
      const rawJid = transfer.students.group_jid || '';
      const groupJid = rawJid.includes('@') ? rawJid : `${rawJid}@g.us`;

      let retrySent = false;
      try {
        if (!transfer.file_url) {
          // Text-only material
          const textRes = await waappaService.sendText(theSessionName, WAAPPA_KEY, groupJid, transfer.caption_text);
          console.log('[retry-material] sendText res:', JSON.stringify(textRes).substring(0, 200));
          retrySent = true;
          const sentMsgId = textRes?.data?.id || textRes?.id || textRes?.response?.id || textRes?.messageId || textRes?.[0]?.id;
          if (sentMsgId) {
            await adminClient.from('whatsapp_messages').insert({
              id: sentMsgId,
              session_name: theSessionName,
              from_jid: theSessionName,
              to_jid: groupJid,
              from_me: true,
              body: transfer.caption_text || '',
              has_media: false,
              sender_role: 'teacher',
              contact_type: 'student',
              contact_phone: groupJid,
              timestamp: Math.floor(Date.now() / 1000)
            }).catch(e => console.error('[retry-material] pre-insert text msg error:', e.message));
          }
        } else {
          // File/media material — send caption first for audio
          if ((transfer.mimetype || '').toLowerCase().startsWith('audio/')) {
            await waappaService.sendText(theSessionName, WAAPPA_KEY, groupJid, transfer.caption_text);
          }
          const mediaRes = await waappaService.sendMedia(theSessionName, WAAPPA_KEY, groupJid, transfer.file_url, transfer.mimetype, transfer.caption_text);
          console.log('[retry-material] sendMedia res:', JSON.stringify(mediaRes).substring(0, 200));
          retrySent = true;
          const sentMsgId = mediaRes?.data?.id || mediaRes?.id || mediaRes?.response?.id || mediaRes?.messageId || mediaRes?.[0]?.id;
          if (sentMsgId) {
            await adminClient.from('whatsapp_messages').insert({
              id: sentMsgId,
              session_name: theSessionName,
              from_jid: theSessionName,
              to_jid: groupJid,
              from_me: true,
              body: transfer.caption_text || '',
              has_media: true,
              media_url: transfer.file_url,
              media_name: transfer.file_url ? transfer.file_url.split('/').pop().split('?')[0] : null,
              media_type: transfer.mimetype,
              sender_role: 'teacher',
              contact_type: 'student',
              contact_phone: groupJid,
              timestamp: Math.floor(Date.now() / 1000)
            }).catch(e => console.error('[retry-material] pre-insert msg error:', e.message));
          } else {
            console.warn('[retry-material] Could not extract sent message ID from Waappa response.');
          }
        }

        await adminClient.from('material_transfers').update({ status: 'sent', error_message: null }).eq('id', transferId);
        sendJson(res, 200, { ok: true, message: 'Transfer retried successfully' });

      } catch (extError) {
        console.error('[retry-material] Error:', extError.message, '| retrySent:', retrySent);
        if (retrySent) {
          // Message was actually delivered — mark as sent despite post-send error
          await adminClient.from('material_transfers').update({ status: 'sent', error_message: null }).eq('id', transferId);
          sendJson(res, 200, { ok: true, message: 'Transfer retried successfully' });
        } else {
          await adminClient.from('material_transfers')
            .update({ error_message: `Retry Failed: ${extError.message}` })
            .eq('id', transferId);
          sendJson(res, 500, { ok: false, error: `Waappa Delivery failed: ${extError.message}` });
        }
      }

      return true;
    }

    // ─── POST /students/import-sheet ──────────────────────────────
    if (req.method === 'POST' && parts.length === 2 && parts[0] === 'students' && parts[1] === 'import-sheet') {
      if (!isAC(actor) && actor.role !== 'super_admin') {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator or super admin can import students' });
        return true;
      }
      const rawPayload = await readJson(req);
      const items = Array.isArray(rawPayload) ? rawPayload : [rawPayload];

      const imported = [];
      const errors = [];

      for (const item of items) {
        try {
          if (!item.student_name) {
            errors.push({ student: item, error: 'student_name is required' });
            continue;
          }

          let studentCode = item.student_code;
          if (!studentCode) {
            studentCode = await generateStudentCode(adminClient);
          }

          const { data: student, error: insertErr } = await adminClient
            .from('students')
            .insert({
              student_name: item.student_name,
              parent_name: item.parent_name || null,
              contact_number: item.contact_number || null,
              class_level: item.class_level || null,
              total_hours: Number(item.total_hours) || 0,
              remaining_hours: Number(item.total_hours) || 0,
              academic_coordinator_id: actor.userId,
              student_code: studentCode,
              status: item.status || 'active',
              joined_at: new Date().toISOString()
            })
            .select('*')
            .single();

          if (insertErr) throw insertErr;
          imported.push(student);

        } catch (e) {
          errors.push({ student: item, error: e.message });
        }
      }

      sendJson(res, 200, { ok: true, imported_count: imported.length, errors });
      return true;
    }

    // ─── DELETE /students/:id ────────────────────────────────────
    if (req.method === 'DELETE' && parts.length === 2 && parts[0] === 'students') {
      if (!isAC(actor) && actor.role !== 'super_admin') {
        sendJson(res, 403, { ok: false, error: 'only academic coordinator or super admin can delete students' });
        return true;
      }
      const studentId = parts[1];
      const hardDelete = url.searchParams.get('hard_delete') === 'true';
      const deleteLead = url.searchParams.get('delete_lead') === 'true';
      const deleteSessions = url.searchParams.get('delete_sessions') === 'true';
      const deleteLedger = url.searchParams.get('delete_ledger') === 'true';
      const deleteMessages = url.searchParams.get('delete_messages') === 'true';

      // Fetch student to confirm it exists
      const { data: student } = await adminClient.from('students').select('id, student_name, lead_id').eq('id', studentId).maybeSingle();
      if (!student) {
        sendJson(res, 404, { ok: false, error: 'student not found' });
        return true;
      }

      // Decouple lead safely first
      await adminClient.from('leads').update({ joined_student_id: null }).eq('joined_student_id', studentId);

      if (hardDelete) {
        // Delete linked data in dependency order
        // 1. Fetch session IDs and student's lead_id BEFORE we start deleting anything
        const { data: sessions } = await adminClient.from('academic_sessions').select('id').eq('student_id', studentId);
        const sessionIds = (sessions || []).map(s => s.id);
        const studentLeadId = student.lead_id || null;

        // --- SECTION: MESSAGES ---
        if (deleteMessages || (hardDelete && !deleteMessages && !deleteSessions && !deleteLedger)) { 
          // Default to old behavior (delete all) only if NO granular flags were passed but hardDelete is true
          const { error: smErr } = await adminClient.from('student_messages').delete().eq('student_id', studentId);
          if (smErr && !smErr.message.includes('Could not find the table')) throw new Error('Hard delete failed at student_messages: ' + smErr.message);
        }

        // --- SECTION: SESSIONS & ASSIGNMENTS ---
        if (deleteSessions || (hardDelete && !deleteMessages && !deleteSessions && !deleteLedger)) {
          if (sessionIds.length > 0) {
            const { error: svErr } = await adminClient.from('session_verifications').delete().in('session_id', sessionIds);
            if (svErr) throw new Error('Hard delete failed at session_verifications: ' + svErr.message);

            const { error: hlErr } = await adminClient.from('hour_ledger').delete().in('session_id', sessionIds);
            if (hlErr && !hlErr.message.includes('Could not find the table')) throw new Error('Hard delete failed at hour_ledger: ' + hlErr.message);
          }

          const { error: sslErr } = await adminClient.from('session_student_links').delete().eq('student_id', studentId);
          if (sslErr && !sslErr.message.includes('Could not find the table')) throw new Error('Hard delete failed at session_student_links: ' + sslErr.message);

          const { error: staErr } = await adminClient.from('student_teacher_assignments').delete().eq('student_id', studentId);
          if (staErr && !staErr.message.includes('Could not find the table')) throw new Error('Hard delete failed at student_teacher_assignments: ' + staErr.message);

          const { error: asErr } = await adminClient.from('academic_sessions').delete().eq('student_id', studentId);
          if (asErr && !asErr.message.includes('Could not find the table')) throw new Error('Hard delete failed at academic_sessions: ' + asErr.message);
        }

        // --- SECTION: FINANCE / LEDGER ---
        if (deleteLedger || (hardDelete && !deleteMessages && !deleteSessions && !deleteLedger)) {
          // Fetch IDs for cascading
          const { data: topups } = await adminClient.from('student_topups').select('id').eq('student_id', studentId);
          const topupIds = (topups || []).map(t => t.id);

          let paymentRequestIds = [];
          if (studentLeadId) {
            const { data: prs } = await adminClient.from('payment_requests').select('id').eq('lead_id', studentLeadId);
            paymentRequestIds = (prs || []).map(p => p.id);
          }

          const allParentIds = [...topupIds, ...paymentRequestIds];
          if (allParentIds.length > 0) {
            const { error: ipErr } = await adminClient.from('installment_payments').delete().in('reference_id', allParentIds);
            if (ipErr && !ipErr.message.includes('Could not find the table')) throw new Error('Hard delete failed at installment_payments: ' + ipErr.message);
          }

          const { error: stErr } = await adminClient.from('student_topups').delete().eq('student_id', studentId);
          if (stErr && !stErr.message.includes('Could not find the table')) throw new Error('Hard delete failed at student_topups: ' + stErr.message);

          const { error: leErr } = await adminClient.from('ledger_entries').delete().eq('student_id', studentId);
          if (leErr && !leErr.message.includes('Could not find the table')) throw new Error('Hard delete failed at ledger_entries: ' + leErr.message);

          const { error: expErr } = await adminClient.from('expenses').delete().eq('student_id', studentId);
          if (expErr && !expErr.message.includes('Could not find the table')) throw new Error('Hard delete failed at expenses: ' + expErr.message);

          if (studentLeadId) {
            const { error: prErr } = await adminClient.from('payment_requests').delete().eq('lead_id', studentLeadId);
            if (prErr && !prErr.message.includes('Could not find the table')) throw new Error('Hard delete failed at payment_requests: ' + prErr.message);
          }
        }

        // --- FINAL: STUDENT & OPTIONAL LEAD ---
        const { error: delErr } = await adminClient.from('students').delete().eq('id', studentId);
        if (delErr) throw new Error('Hard delete failed at students: ' + delErr.message);

        if (deleteLead && studentLeadId) {
          const { error: lErr } = await adminClient.from('leads').delete().eq('id', studentLeadId);
          if (lErr) throw new Error('Hard delete failed at leads: ' + lErr.message);
        }
      } else {
        // Soft Delete
        const { error: softErr } = await adminClient.from('students').update({ deleted_at: new Date().toISOString(), status: 'inactive' }).eq('id', studentId);
        if (softErr) throw new Error('Soft delete failed: ' + softErr.message);
      }

      sendJson(res, 200, { ok: true, deleted: student.student_name });
      return true;
    }


    // ─── GET /students/:id/remarks ─────────────────────────
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'remarks') {
      if (!['academic_coordinator', 'teacher', 'finance', 'super_admin', 'counselor'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'not allowed to view remarks' });
        return true;
      }
      const studentId = parts[1];
      const { data, error } = await adminClient
        .from('student_remarks')
        .select('*, creator:created_by(id, full_name)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true, items: data || [] });
      return true;
    }

    // ─── POST /students/:id/remarks ────────────────────────
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'students' && parts[2] === 'remarks') {
      if (!['academic_coordinator', 'teacher', 'finance', 'super_admin', 'counselor'].includes(actor.role)) {
        sendJson(res, 403, { ok: false, error: 'not allowed to add remarks' });
        return true;
      }
      const studentId = parts[1];
      const payload = await readJson(req);

      if (!payload.title || !payload.title.trim()) {
        sendJson(res, 400, { ok: false, error: 'title is required' });
        return true;
      }

      const remarkTypes = ['general', 'parents_meeting', 'exam', 'attendance', 'behaviour', 'custom'];
      const remarkType = remarkTypes.includes(payload.remark_type) ? payload.remark_type : 'general';

      const { data, error } = await adminClient
        .from('student_remarks')
        .insert({
          student_id: studentId,
          remark_type: remarkType,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          marks: payload.marks?.trim() || null,
          created_by: actor.userId,
          created_at: nowIso()
        })
        .select('*, creator:created_by(id, full_name)')
        .single();

      if (error) throw new Error(error.message);
      sendJson(res, 201, { ok: true, remark: data });
      return true;
    }

    // ─── PUT /students/:id/remarks/:remark_id ────────────────
    if (req.method === 'PUT' && parts.length === 4 && parts[0] === 'students' && parts[2] === 'remarks') {
      const studentId = parts[1];
      const remarkId = parts[3];
      const payload = await readJson(req);

      if (!payload.title || !payload.title.trim()) {
        sendJson(res, 400, { ok: false, error: 'title is required' });
        return true;
      }

      // Check ownership or admin
      const { data: extRemark, error: extErr } = await adminClient.from('student_remarks').select('created_by').eq('id', remarkId).single();
      if (extErr || !extRemark) {
        sendJson(res, 404, { ok: false, error: 'remark not found' });
        return true;
      }
      if (!['academic_coordinator', 'super_admin'].includes(actor.role) && extRemark.created_by !== actor.userId) {
        sendJson(res, 403, { ok: false, error: 'you can only edit your own remarks' });
        return true;
      }

      const remarkTypes = ['general', 'parents_meeting', 'exam', 'attendance', 'behaviour', 'custom'];
      const remarkType = remarkTypes.includes(payload.remark_type) ? payload.remark_type : 'general';

      const { data, error } = await adminClient
        .from('student_remarks')
        .update({
          remark_type: remarkType,
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          marks: payload.marks?.trim() || null
        })
        .eq('id', remarkId)
        .select('*, creator:created_by(id, full_name)')
        .single();

      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true, remark: data });
      return true;
    }

    // ─── DELETE /students/:id/remarks/:remark_id ─────────────
    if (req.method === 'DELETE' && parts.length === 4 && parts[0] === 'students' && parts[2] === 'remarks') {
      const remarkId = parts[3];
      
      const { data: extRemark, error: extErr } = await adminClient.from('student_remarks').select('created_by').eq('id', remarkId).single();
      if (extErr || !extRemark) {
        sendJson(res, 404, { ok: false, error: 'remark not found' });
        return true;
      }
      if (!['academic_coordinator', 'super_admin'].includes(actor.role) && extRemark.created_by !== actor.userId) {
        sendJson(res, 403, { ok: false, error: 'you can only delete your own remarks' });
        return true;
      }

      const { error } = await adminClient.from('student_remarks').delete().eq('id', remarkId);
      if (error) throw new Error(error.message);

      sendJson(res, 200, { ok: true, deleted: true });
      return true;
    }

    sendJson(res, 404, { ok: false, error: 'route not found' });

    return true;
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || 'internal server error' });
    return true;
  }
}
