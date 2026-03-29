import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Checking Payment Requests created around 2026-03-26T17:18 ---');
  const { data: paymentRequests, error: prError } = await supabase
    .from('payment_requests')
    .select('*, leads(student_name, status)')
    .gte('created_at', '2026-03-26T17:10:00Z')
    .lte('created_at', '2026-03-26T17:30:00Z');
  
  if (prError) console.error('Payment Request Error:', prError);
  else console.log('Payment Requests:', paymentRequests);
}

check();
