import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ids = [
  '7169a396-64c2-4656-a04d-ba5211ed6170', // Mahir
  '7c8ea30e-7d0e-4f11-a031-b88ff31fe8e3', // rishan
  'fa4631a7-23f7-457b-ac53-f389c981d874', // sreelekshmi
  '61643937-2e3e-40a6-9923-7ab09e4f0e36', // Amaan
  'b63a20a7-2130-4290-bb6d-fd77293e4169'  // HITHEN
];

async function check() {
  console.log('\n--- Checking status history of missing PR leads ---');
  const { data, error } = await supabase
    .from('lead_status_history')
    .select('*, leads(student_name)')
    .in('lead_id', ids)
    .eq('to_status', 'payment_verification')
    .order('created_at', { ascending: false });
  
  if (error) console.error('Error:', error);
  else {
    data.forEach(h => {
      console.log(`${h.created_at} | ${h.leads?.student_name} | changed_by: ${h.changed_by} | reason: ${h.reason}`);
    });
  }
}

check();
