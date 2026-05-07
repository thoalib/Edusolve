import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // 1. Fetch all approved session_verifications with new_duration
  const { data: verifs } = await supabase
    .from('session_verifications')
    .select('id, session_id, new_duration, academic_sessions!inner(student_id, teacher_id)')
    .eq('type', 'approval')
    .eq('status', 'approved')
    .not('new_duration', 'is', null);

  console.log(`Found ${verifs.length} approved verifications.`);

  let fixCount = 0;

  for (const v of verifs) {
    const verifiedDuration = Number(v.new_duration);
    const sessionId = v.session_id;

    // 2. Sum up all ledger entries for this session
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

    // If total student debit does NOT match verifiedDuration
    if (Math.abs(studentDebitTotal - verifiedDuration) > 0.001) {
      const differenceToFix = studentDebitTotal - verifiedDuration;
      
      console.log(`Session ${sessionId}: Verified=${verifiedDuration}, LedgerTotal=${studentDebitTotal}. Need to adjust by ${differenceToFix} (Credit student back ${differenceToFix})`);
      
      // If differenceToFix > 0, it means we deducted TOO MUCH. We need to credit the student back that amount, and debit the teacher back that amount.
      // If differenceToFix < 0, it means we deducted TOO LITTLE. We need to debit the student more, and credit the teacher more.

      // We use our standard entry types:
      // To credit student (give hours back): entry_type='student_credit', hours_delta = differenceToFix
      // To debit teacher (take hours back): entry_type='teacher_debit', hours_delta = -differenceToFix
      
      // Wait, is there a 'student_credit' and 'teacher_debit' entry_type used in the app for session corrections?
      // Usually, session deductions use 'student_debit' and 'teacher_credit'.
      // If we overcharged by 1.5, we can just insert a 'student_debit' with a POSITIVE 1.5! (Since debits are usually negative, a positive debit is a credit).
      // Let's look at how the edit logic works:
      // Edit logic: delta = newDur - oldDur. If new > old, delta is positive. 
      // It inserts: student_debit with -delta. (So if new is 2, old is 1.5, delta is 0.5. It inserts student_debit of -0.5).
      
      // Let's just insert a balancing student_debit and teacher_credit.
      // delta = newDur - ledgerTotal.
      const delta = verifiedDuration - studentDebitTotal;

      await supabase.from('hour_ledger').insert([
        {
          student_id: v.academic_sessions.student_id,
          teacher_id: v.academic_sessions.teacher_id,
          session_id: sessionId,
          hours_delta: -delta, // If delta is -1.5, this becomes +1.5 (student gets hours back)
          entry_type: 'student_debit',
          notes: `System Correction: Aligning ledger (${studentDebitTotal}h) with verified hours (${verifiedDuration}h)`,
          created_at: new Date().toISOString()
        },
        {
          student_id: v.academic_sessions.student_id,
          teacher_id: v.academic_sessions.teacher_id,
          session_id: sessionId,
          hours_delta: delta, // If delta is -1.5, this becomes -1.5 (teacher loses the over-credited hours)
          entry_type: 'teacher_credit',
          notes: `System Correction: Aligning ledger (${studentDebitTotal}h) with verified hours (${verifiedDuration}h)`,
          created_at: new Date().toISOString()
        }
      ]);

      // Adjust the student's remaining_hours
      const { data: student } = await supabase.from('students').select('id, remaining_hours').eq('id', v.academic_sessions.student_id).maybeSingle();
      if (student) {
        // If delta is negative (e.g. -1.5), we need to add 1.5 back to the student.
        // remaining = remaining - delta. (remaining - (-1.5) = remaining + 1.5).
        const remaining = Number(student.remaining_hours || 0) - delta;
        await supabase.from('students').update({ remaining_hours: remaining }).eq('id', student.id);
      }
      
      fixCount++;
    }
  }

  console.log(`Fixed ${fixCount} out of sync ledgers.`);
}

run();
