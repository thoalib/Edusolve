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
  const { data: students } = await db.from('students').select('id, student_name, lead_id').is('deleted_at', null).not('lead_id', 'is', null).limit(10);
  
  if (!students || students.length === 0) { console.log('No students with lead_id found'); process.exit(0); }

  for (const student of students) {
    console.log(`Checking Student: ${student.student_name} | lead_id: ${student.lead_id}`);
    const { data: demoByLead } = await db.from('demo_sessions').select('id, scheduled_at, lead_id').eq('lead_id', student.lead_id);
    const { data: demoByStudent } = await db.from('demo_sessions').select('id, scheduled_at, lead_id').eq('student_id', student.id).catch(() => ({data: []}));
    
    console.log(`  - Demos by lead_id: ${demoByLead?.length || 0}`);
    console.log(`  - Demos by student_id: ${demoByStudent?.length || 0}`);
  }
}

run().catch(e => console.error(e.message));
