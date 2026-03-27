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
  .select('id, status, demo_number')
  .eq('lead_id', '94ea7dd1-972c-4bf0-bb83-ad6fc5908fe3')
  .order('demo_number', { ascending: true });

const toDelete = (data || []).filter(d => d.status !== 'done');
const toKeep = (data || []).filter(d => d.status === 'done');

console.log('Keeping:', toKeep.map(d => d.id));
console.log('Deleting:', toDelete.map(d => d.id));
console.log('\n-- SQL to run in Supabase:');
console.log(`DELETE FROM demo_sessions WHERE id IN ('${toDelete.map(d => d.id).join("', '")}');`);
