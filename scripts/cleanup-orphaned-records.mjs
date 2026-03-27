/**
 * cleanup-orphaned-records.mjs
 * Finds and deletes orphaned finance/session records whose student has already been deleted.
 *
 * Usage (from project root):
 *   node scripts/cleanup-orphaned-records.mjs
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Manually load env from apps/api/.env
const envFile = readFileSync('apps/api/.env', 'utf8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx < 0) continue;
  const k = trimmed.slice(0, idx).trim();
  const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  process.env[k] = v;
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in apps/api/.env');
  process.exit(1);
}

const db = createClient(url, key);

async function del(table, filter, col) {
  const { error } = await db.from(table).delete().eq(col, filter);
  if (error && !error.message.includes('Could not find the table')) {
    console.warn(`   ⚠️  ${table}: ${error.message}`);
  }
}

async function run() {
  // --- 1. Find orphaned student_topups ---
  // A topup is orphaned if its student no longer exists OR is soft-deleted (deleted_at set)
  const { data: allTopups } = await db.from('student_topups').select('id, student_id');
  const { data: activeStudents } = await db.from('students').select('id').is('deleted_at', null);
  const activeStudentIds = new Set((activeStudents || []).map(s => s.id));

  const orphanTopups = (allTopups || []).filter(t => !t.student_id || !activeStudentIds.has(t.student_id));
  console.log(`🔍  Orphaned student_topups: ${orphanTopups.length}`);

  // --- 2. Find orphaned payment_requests ---
  // Any payment_request on a lead that has no joined_student (student was deleted)
  const { data: orphanLeads } = await db
    .from('leads')
    .select('id')
    .is('joined_student_id', null);

  const orphanLeadIds = (orphanLeads || []).map(l => l.id);

  // Only pick up non-verified ones (verified = student was created, might be legitimate)
  const { data: orphanPRs } = orphanLeadIds.length > 0
    ? await db.from('payment_requests').select('id, lead_id, status').in('lead_id', orphanLeadIds).in('status', ['pending', 'rejected'])
    : { data: [] };
  console.log(`🔍  Orphaned payment_requests: ${orphanPRs?.length || 0}`);


  // --- 3. Delete installment_payments for orphaned topups + payment_requests ---
  const allOrphanParentIds = [
    ...(orphanTopups || []).map(t => t.id),
    ...(orphanPRs || []).map(p => p.id),
  ];
  if (allOrphanParentIds.length > 0) {
    const { error } = await db.from('installment_payments').delete().in('reference_id', allOrphanParentIds);
    if (error && !error.message.includes('Could not find the table')) {
      console.warn(`   ⚠️  installment_payments: ${error.message}`);
    } else {
      console.log(`   ✅  Deleted installment_payments for orphaned parents`);
    }
  }

  // --- 4. Delete orphaned student_topups ---
  for (const t of orphanTopups) {
    await del('student_topups', t.id, 'id');
  }
  if (orphanTopups.length) console.log(`   ✅  Deleted ${orphanTopups.length} orphaned student_topups`);

  // --- 5. Delete orphaned payment_requests ---
  for (const p of orphanPRs || []) {
    await del('payment_requests', p.id, 'id');
  }
  if (orphanPRs?.length) console.log(`   ✅  Deleted ${orphanPRs.length} orphaned payment_requests`);



  // --- 7. Orphaned ledger_entries ---
  const { data: orphanedLedger } = await db
    .from('ledger_entries')
    .select('id, student_id')
    .not('student_id', 'is', null);
  const orphanLedger = (orphanedLedger || []).filter(l => !activeStudentIds.has(l.student_id));
  if (orphanLedger.length > 0) {
    await db.from('ledger_entries').delete().in('id', orphanLedger.map(l => l.id));
    console.log(`   ✅  Deleted ${orphanLedger.length} orphaned ledger_entries`);
  }

  console.log('\n✅  Orphan cleanup complete.');
}

run().catch(e => { console.error('❌  Unexpected error:', e.message); process.exit(1); });
