/**
 * fix-lead-statuses.mjs
 * Restores leads to 'joined' status where the student still exists.
 * Run this to undo the incorrect lead reset.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Find all active students who have a lead_id
  const { data: activeStudents } = await db
    .from('students')
    .select('id, lead_id, student_name')
    .is('deleted_at', null)
    .not('lead_id', 'is', null);

  console.log(`🔍 Active students with lead_id: ${activeStudents?.length}`);

  let fixed = 0;
  for (const s of activeStudents || []) {
    const { error } = await db
      .from('leads')
      .update({ status: 'joined', joined_student_id: s.id, owner_stage: 'academic' })
      .eq('id', s.lead_id);
    if (error) {
      console.warn(`  ⚠️ Failed for ${s.student_name}: ${error.message}`);
    } else {
      fixed++;
    }
  }

  console.log(`✅ Restored ${fixed} leads back to 'joined' with correct joined_student_id.`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
