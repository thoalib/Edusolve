import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = readFileSync('apps/api/.env', 'utf8');
for (const line of envFile.split('\n')) {
  const t = line.trim(); if (!t||t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i<0) continue;
  process.env[t.slice(0,i).trim()] = t.slice(i+1).trim().replace(/^["']|["']$/g,'');
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data } = await db.from('demo_sessions')
  .select('id, lead_id, subject, status, scheduled_at, demo_number, created_at')
  .eq('lead_id', '94ea7dd1-972c-4bf0-bb83-ad6fc5908fe3')
  .order('created_at', { ascending: true });

console.log(`Total records: ${data?.length}`);
(data || []).forEach((d, i) => {
  console.log(`[${i+1}] id: ${d.id.slice(0,8)} | #${d.demo_number} | status: ${d.status} | at: ${d.scheduled_at} | created: ${d.created_at}`);
});
