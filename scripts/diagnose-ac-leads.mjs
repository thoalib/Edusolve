/**
 * diagnose-ac-leads.mjs
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
const envFile = readFileSync('apps/api/.env', 'utf8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim(); if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('='); if (idx < 0) continue;
  process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Students that have lead_id pointing to an 'AC Direct Onboarding' lead
  const { data: students } = await db.from('students').select('id, student_name, lead_id').is('deleted_at', null).not('lead_id', 'is', null);
  const leadIds = students.map(s => s.lead_id);
  
  const { data: leads } = await db.from('leads').select('id, source, status, joined_student_id').in('id', leadIds);
  
  const acLeads = leads.filter(l => l.source === 'AC Direct Onboarding');
  const mislinked = acLeads.filter(l => !l.joined_student_id);
  
  console.log(`Total active students with lead_id: ${students.length}`);
  console.log(`AC Direct Onboarding leads: ${acLeads.length}`);
  console.log(`AC leads MISSING joined_student_id (broken): ${mislinked.length}`);
  if (mislinked.length > 0) {
    for (const l of mislinked) {
      const s = students.find(st => st.lead_id === l.id);
      console.log(`  - Lead ${l.id} (status: ${l.status}) → Student: ${s?.student_name}`);
    }
    
    // Fix them
    console.log('\nFixing...');
    for (const l of mislinked) {
      const s = students.find(st => st.lead_id === l.id);
      if (!s) continue;
      const { error } = await db.from('leads').update({ joined_student_id: s.id, status: 'joined', owner_stage: 'academic' }).eq('id', l.id);
      if (error) console.log(`  ❌ ${s.student_name}: ${error.message}`);
      else console.log(`  ✅ Restored: ${s.student_name}`);
    }
  }
  console.log('\nDone.');
}
run().catch(e => console.error('Error:', e.message));
