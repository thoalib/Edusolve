/**
 * show-student-lead-sources.mjs
 * Shows the lead source for all active students that have a lead_id
 */
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
  const { data: students } = await db.from('students').select('id, student_name, lead_id').is('deleted_at', null);
  const withLead = students.filter(s => s.lead_id);
  const noLead = students.filter(s => !s.lead_id);

  console.log(`\nTotal active students: ${students.length}`);
  console.log(`  With lead_id: ${withLead.length}`);
  console.log(`  Without lead_id (old/direct): ${noLead.length}`);

  if (withLead.length > 0) {
    const leadIds = withLead.map(s => s.lead_id);
    const { data: leads } = await db.from('leads').select('id, source').in('id', leadIds);
    const sourceMap = {};
    for (const l of leads || []) sourceMap[l.id] = l.source;

    console.log('\nBreakdown of lead sources for students with lead_id:');
    const groups = {};
    for (const s of withLead) {
      const src = sourceMap[s.lead_id] || '(null/unknown)';
      groups[src] = groups[src] || [];
      groups[src].push(s.student_name);
    }
    for (const [src, names] of Object.entries(groups)) {
      console.log(`  "${src}": ${names.length} student(s) — ${names.join(', ')}`);
    }
  }
}

run().catch(e => console.error('Error:', e.message));
