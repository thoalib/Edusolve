/**
 * cleanup-deleted-students.mjs
 * One-time script to wipe orphaned records for students already soft-deleted
 * (i.e. students where deleted_at IS NOT NULL).
 *
 * Usage:
 *   node --env-file=apps/api/.env scripts/cleanup-deleted-students.mjs
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const db = createClient(url, key);

async function run() {
  // 1. Fetch all soft-deleted students
  const { data: students, error: sErr } = await db
    .from('students')
    .select('id, student_name, lead_id, deleted_at')
    .not('deleted_at', 'is', null);

  if (sErr) { console.error('Failed to fetch deleted students:', sErr.message); process.exit(1); }
  if (!students?.length) { console.log('✅  No soft-deleted students found — nothing to clean up.'); return; }

  console.log(`🔍  Found ${students.length} soft-deleted student(s). Starting cleanup...\n`);

  for (const student of students) {
    try {
      console.log(`→ Processing: ${student.student_name} (${student.id})`);

      // Gather session IDs
      const { data: sessions } = await db.from('academic_sessions').select('id').eq('student_id', student.id);
      const sessionIds = (sessions || []).map(s => s.id);

      // Gather payment_request IDs via lead
      let paymentRequestIds = [];
      if (student.lead_id) {
        const { data: prs } = await db.from('payment_requests').select('id').eq('lead_id', student.lead_id);
        paymentRequestIds = (prs || []).map(p => p.id);
      }

      // Gather topup IDs
      const { data: topups } = await db.from('student_topups').select('id').eq('student_id', student.id);
      const topupIds = (topups || []).map(t => t.id);

      // Decouple lead
      await db.from('leads').update({ joined_student_id: null }).eq('joined_student_id', student.id);

      // Delete in dependency order
      if (sessionIds.length > 0) {
        await db.from('session_verifications').delete().in('session_id', sessionIds);
        await db.from('hour_ledger').delete().in('session_id', sessionIds);
      }

      await db.from('session_student_links').delete().eq('student_id', student.id);
      await db.from('student_teacher_assignments').delete().eq('student_id', student.id);
      await db.from('student_messages').delete().eq('student_id', student.id);

      const allParentIds = [...topupIds, ...paymentRequestIds];
      if (allParentIds.length > 0) {
        await db.from('installment_payments').delete().in('reference_id', allParentIds);
      }

      await db.from('student_topups').delete().eq('student_id', student.id);
      await db.from('academic_sessions').delete().eq('student_id', student.id);
      await db.from('ledger_entries').delete().eq('student_id', student.id);
      await db.from('expenses').delete().eq('student_id', student.id);

      if (student.lead_id) {
        await db.from('payment_requests').delete().eq('lead_id', student.lead_id);
      }

      // Finally, hard delete the student record
      const { error: delErr } = await db.from('students').delete().eq('id', student.id);
      if (delErr) throw new Error(delErr.message);

      console.log(`   ✅  Cleaned up ${student.student_name}`);
    } catch (err) {
      console.error(`   ❌  Failed for ${student.student_name}: ${err.message}`);
    }
  }

  console.log('\n✅  Cleanup complete.');
}

run();
