import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = readFileSync('apps/api/.env', 'utf8');
for (const line of envFile.split('\n')) {
  const t = line.trim(); if (!t||t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i<0) continue;
  process.env[t.slice(0,i).trim()] = t.slice(i+1).trim().replace(/^["']|["']$/g,'');
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('=== Check 1: All demo sessions and their lead info ===');
const { data: demos } = await db.from('demo_sessions').select('lead_id, subject, status');
const uniqueLeadIds = [...new Set((demos || []).map(d => d.lead_id))];
console.log(`Total demo sessions: ${demos?.length}, unique lead_ids: ${uniqueLeadIds.length}`);
console.log('Lead IDs from demo_sessions:', uniqueLeadIds);

console.log('\n=== Check 2: Students that have one of those lead_ids ===');
const { data: students } = await db.from('students').select('id, student_name, lead_id').is('deleted_at', null).in('lead_id', uniqueLeadIds);
console.log(`Students whose lead_id matches a demo session: ${students?.length}`);
(students || []).forEach(s => console.log(` -> ${s.student_name} | lead_id: ${s.lead_id}`));

console.log('\n=== Check 3: Those demo lead_ids — what do the leads look like? ===');
const { data: leads } = await db.from('leads').select('id, student_name, status, joined_student_id').in('id', uniqueLeadIds.slice(0, 5));
(leads || []).forEach(l => console.log(` -> Lead: ${l.student_name} | status: ${l.status} | joined_student_id: ${l.joined_student_id}`));
