import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ids = [
  '61643937-2e3e-40a6-9923-7ab09e4f0e36',
  'fa4631a7-23f7-457b-ac53-f389c981d874',
  '7c8ea30e-7d0e-4f11-a031-b88ff31fe8e3',
  '7169a396-64c2-4656-a04d-ba5211ed6170'
];

async function check() {
  console.log('\n--- Checking status of other leads with history of verification ---');
  const { data, error } = await supabase
    .from('leads')
    .select('id, student_name, status, owner_stage')
    .in('id', ids);
  
  if (error) console.error('Error:', error);
  else {
    data.forEach(l => {
      console.log(`${l.id} | ${l.student_name} | status: ${l.status} | owner: ${l.owner_stage}`);
    });
  }
}

check();
