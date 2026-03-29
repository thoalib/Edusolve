import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const leadId = 'b63a20a7-2130-4290-bb6d-fd77293e4169';
const counselorId = '1b01e96e-6118-4511-b5dc-230dd5cd6151';

async function check() {
  console.log('--- Checking Lead ---');
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();
  
  if (leadError) console.error('Lead Error:', leadError);
  else console.log('Lead:', lead);

  console.log('\n--- Checking Payment Requests ---');
  const { data: paymentRequests, error: prError } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('lead_id', leadId);
  
  if (prError) console.error('Payment Request Error:', prError);
  else console.log('Payment Requests:', paymentRequests);

  console.log('\n--- Checking General Requests (if any) ---');
  const { data: requests, error: rError } = await supabase
    .from('requests')
    .select('*')
    .eq('counselor_id', counselorId);
  
  if (rError) console.error('Requests Error:', rError);
  else console.log('Requests for Counselor:', requests);

  console.log('\n--- Checking Councilor User Info ---');
  const { data: counselor, error: cError } = await supabase
    .from('users')
    .select('*')
    .eq('id', counselorId)
    .single();
  
  if (cError) console.error('Counselor Error:', cError);
  else console.log('Counselor:', counselor);
}

check();
