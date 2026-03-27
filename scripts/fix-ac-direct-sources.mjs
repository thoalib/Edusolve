import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
const envFile = readFileSync('apps/api/.env', 'utf8');
for (const line of envFile.split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i<0) continue;
  process.env[t.slice(0,i).trim()] = t.slice(i+1).trim().replace(/^["']|["']$/g,'');
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: students } = await db.from('students').select('id, student_name, lead_id').is('deleted_at', null).not('lead_id', 'is', null);
const leadIds = students.map(s => s.lead_id);
const { data: leads } = await db.from('leads').select('id, source').in('id', leadIds);
const nullSourceLeadIds = leads.filter(l => !l.source).map(l => l.id);

if (nullSourceLeadIds.length === 0) { console.log('No null-source leads found.'); process.exit(0); }

const { error } = await db.from('leads').update({ source: 'AC Direct Onboarding' }).in('id', nullSourceLeadIds);
if (error) { console.error('Failed:', error.message); process.exit(1); }
console.log('Updated ' + nullSourceLeadIds.length + ' leads to AC Direct Onboarding. Done!');
