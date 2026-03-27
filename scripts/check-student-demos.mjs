import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = readFileSync('apps/api/.env', 'utf8');
for (const line of envFile.split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i<0) continue;
  process.env[t.slice(0,i).trim()] = t.slice(i+1).trim().replace(/^["']|["']$/g,'');
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: students } = await db.from('students').select('id, student_name, lead_id').is('deleted_at', null).limit(20);
  
  console.log('--- Student Demo Check ---');
  for (const s of students || []) {
    const { data: byLead } = s.lead_id ? await db.from('demo_sessions').select('id').eq('lead_id', s.lead_id) : {data: []};
    const { data: byStudent } = await db.from('demo_sessions').select('id').eq('student_id', s.id);
    
    if ((byLead?.length || 0) > 0 || (byStudent?.length || 0) > 0) {
      console.log(`Student: ${s.student_name}`);
      console.log(`  lead_id: ${s.lead_id}`);
      console.log(`  Demos by lead_id: ${byLead?.length || 0}`);
      console.log(`  Demos by student_id: ${byStudent?.length || 0}`);
    }
  }
}

run().catch(e => console.error(e.message));
