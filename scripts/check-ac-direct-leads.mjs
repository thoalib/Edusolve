/**
 * check-ac-direct-leads.mjs
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
  // AC Direct Onboarding leads (pending student creation)
  const { data: acLeads } = await db
    .from('leads')
    .select('id, student_name, status, joined_student_id, created_at')
    .eq('source', 'AC Direct Onboarding')
    .order('created_at', { ascending: false });

  console.log(`\nAC Direct Onboarding leads total: ${acLeads?.length || 0}`);

  for (const l of acLeads || []) {
    // Check for payment request
    const { data: prs } = await db.from('payment_requests').select('id, status, amount, total_amount').eq('lead_id', l.id);
    const prSummary = prs?.length ? prs.map(p => `${p.status} ₹${p.amount}`).join(', ') : '⚠️  NO PAYMENT REQUEST (deleted!)';
    console.log(`  • ${l.student_name} | lead: ${l.status} | joined: ${l.joined_student_id ? '✅' : '❌ null'} | payment: ${prSummary}`);
  }
}

run().catch(e => console.error('Error:', e.message));
