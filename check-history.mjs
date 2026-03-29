import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const counselorId = '1b01e96e-6118-4511-b5dc-230dd5cd6151';

async function check() {
  console.log('\n--- Checking Payment Requests by this Counselor ---');
  const { data: paymentRequests, error: prError } = await supabase
    .from('payment_requests')
    .select('*, leads(student_name, status)')
    .eq('requested_by', counselorId)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (prError) console.error('Payment Request Error:', prError);
  else console.log('Payment Requests:', paymentRequests);

  console.log('\n--- Checking lead history for b63a20a7-2130-4290-bb6d-fd77293e4169 ---');
  const { data: history, error: hError } = await supabase
    .from('lead_status_history')
    .select('*')
    .eq('lead_id', 'b63a20a7-2130-4290-bb6d-fd77293e4169')
    .order('created_at', { ascending: false });
  
  if (hError) console.error('History Error:', hError);
  else console.log('History:', history);
}

check();
