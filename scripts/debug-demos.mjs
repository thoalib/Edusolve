import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = readFileSync('apps/api/.env', 'utf8');
for (const line of envFile.split('\n')) {
  const t = line.trim(); if (!t||t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i<0) continue;
  process.env[t.slice(0,i).trim()] = t.slice(i+1).trim().replace(/^["']|["']$/g,'');
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await db.from('demo_sessions').select('*').limit(1);
if (error) { console.error('ERROR:', error.message); process.exit(1); }

if (!data || data.length === 0) {
  console.log('No demo_sessions found at all!');
} else {
  console.log('demo_sessions columns:', Object.keys(data[0]));
  console.log('Sample row:', JSON.stringify(data[0], null, 2));
}

// Now check: find a lead with status joined and its demo sessions
const { data: joinedLeads } = await db.from('leads').select('id, student_name, joined_student_id').eq('status', 'joined').limit(5);
console.log('\nJoined leads:');
for (const l of joinedLeads || []) {
  const { data: demos } = await db.from('demo_sessions').select('id, subject, status, lead_id, student_id').eq('lead_id', l.id);
  console.log(` -> ${l.student_name} | joined_student_id: ${l.joined_student_id} | demos: ${demos?.length}`);
  if (demos?.length) console.log('   demo[0]:', JSON.stringify(demos[0]));
}

//  Check if students table has lead_id linked correctly 
const { data: students } = await db.from('students').select('id, student_name, lead_id').is('deleted_at', null).not('lead_id','is',null).limit(5);
console.log('\nStudents with lead_id:');
for (const s of students || []) {
  const { data: demos } = await db.from('demo_sessions').select('id').eq('lead_id', s.lead_id);
  console.log(` -> ${s.student_name} | lead_id: ${s.lead_id} | demos by lead_id: ${demos?.length}`);
}
