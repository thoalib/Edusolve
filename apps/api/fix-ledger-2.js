import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchAllVerifications() {
  let allData = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('session_verifications')
      .select('id, session_id, new_duration, academic_sessions!inner(student_id, teacher_id)')
      .eq('type', 'approval')
      .eq('status', 'approved')
      .not('new_duration', 'is', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) hasMore = false;
      page++;
    }
  }
  return allData;
}

async function run() {
  const verifs = await fetchAllVerifications();
  console.log(`Found ${verifs.length} total approved verifications.`);

  let fixCount = 0;

  for (const v of verifs) {
    const verifiedDuration = Number(v.new_duration);
    const sessionId = v.session_id;

    const { data: ledgerEntries } = await supabase
      .from('hour_ledger')
      .select('hours_delta, entry_type')
      .eq('session_id', sessionId);

    if (!ledgerEntries || ledgerEntries.length === 0) continue;

    let studentDebitTotal = 0;
    for (const entry of ledgerEntries) {
      if (entry.entry_type === 'student_debit') {
        studentDebitTotal += Math.abs(Number(entry.hours_delta));
      }
    }

    if (Math.abs(studentDebitTotal - verifiedDuration) > 0.001) {
      const delta = verifiedDuration - studentDebitTotal;
      
      console.log(`Session ${sessionId}: Verified=${verifiedDuration}, LedgerTotal=${studentDebitTotal}. Need to adjust by ${-delta} (Delta: ${delta})`);
      
      await supabase.from('hour_ledger').insert([
        {
          student_id: v.academic_sessions.student_id,
          teacher_id: v.academic_sessions.teacher_id,
          session_id: sessionId,
          hours_delta: -delta,
          entry_type: 'student_debit',
          notes: `System Correction: Aligning ledger (${studentDebitTotal}h) with verified hours (${verifiedDuration}h)`,
          created_at: new Date().toISOString()
        },
        {
          student_id: v.academic_sessions.student_id,
          teacher_id: v.academic_sessions.teacher_id,
          session_id: sessionId,
          hours_delta: delta,
          entry_type: 'teacher_credit',
          notes: `System Correction: Aligning ledger (${studentDebitTotal}h) with verified hours (${verifiedDuration}h)`,
          created_at: new Date().toISOString()
        }
      ]);

      const { data: student } = await supabase.from('students').select('id, remaining_hours').eq('id', v.academic_sessions.student_id).maybeSingle();
      if (student) {
        const remaining = Number(student.remaining_hours || 0) - delta;
        await supabase.from('students').update({ remaining_hours: remaining }).eq('id', student.id);
      }
      fixCount++;
    }
  }

  console.log(`Fixed ${fixCount} out of sync ledgers.`);
}

run();
