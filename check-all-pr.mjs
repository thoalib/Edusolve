import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Checking ALL Payment Requests created in last 48 hours ---');
  const { data: paymentRequests, error: prError } = await supabase
    .from('payment_requests')
    .select('*, leads(student_name, status)')
    .gte('created_at', new Date(Date.now() - 48 * 3600000).toISOString())
    .order('created_at', { ascending: false });
  
  if (prError) console.error('Payment Request Error:', prError);
  else console.log('Payment Requests:', paymentRequests);
}

check();
