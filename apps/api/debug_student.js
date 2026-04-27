import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const code = 'MR0250810';
  const { data: student } = await supabase.from('students').select('*').eq('student_code', code).single();
  if (!student) {
    console.log("Student not found");
    return;
  }
  console.log("--- STUDENT DATA ---");
  console.log({ id: student.id, name: student.student_name, total: student.total_hours, remaining: student.remaining_hours, joined: student.joined_at });

  const { data: topups } = await supabase.from('student_topups').select('amount, hours_added, status, created_at, finance_note').eq('student_id', student.id);
  console.log("\n--- TOPUPS ---");
  console.log(topups);

  const { data: payments } = await supabase.from('payment_requests').select('amount, hours, total_amount, status, created_at, finance_note, lead_id').eq('status', 'verified');
  // Need to find payments that match the lead_id of the student, but student.lead_id might be null if added directly.
  const matchedPayments = payments.filter(p => p.lead_id === student.lead_id);
  console.log("\n--- PAYMENT REQUESTS ---");
  console.log(matchedPayments);

  const { data: sessions } = await supabase.from('academic_sessions').select('duration_hours, status, session_date').eq('student_id', student.id).eq('status', 'completed');
  let totalSess = 0;
  sessions.forEach(s => totalSess += Number(s.duration_hours));
  console.log("\n--- SESSIONS ---");
  console.log(`Total completed sessions: ${sessions.length}`);
  console.log(`Total completed hours: ${totalSess}`);

  const { data: ledger } = await supabase.from('ledger_entries').select('entry_type, amount, description, entry_date').eq('student_id', student.id).ilike('description', '%Hour Adjustment%');
  console.log("\n--- MANUAL ADJUSTMENTS (Ledger) ---");
  console.log(ledger);
  
  const { data: hourLedg } = await supabase.from('hour_ledger').select('hours_delta, entry_type, created_at').eq('student_id', student.id);
  console.log("\n--- HOUR LEDGER ---");
  let hrTotal = 0;
  hourLedg?.forEach(h => hrTotal += Number(h.hours_delta));
  console.log(hourLedg?.slice(0, 5) || [], "...", "Total delta:", hrTotal);
}

check().catch(console.error);
