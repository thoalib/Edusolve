import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Checking column info for lead_status_history ---');
  // Since we can't query information_schema directly easily without RPC, let's try to insert a null and catch specific error if needed? No, user already did.
  // Let's use the known Counselor IDs for each lead as 'changed_by'.
  
  const leads = [
    { id: 'b63a20a7-2130-4290-bb6d-fd77293e4169', name: 'HITHEN SANTH' },
    { id: '61643937-2e3e-40a6-9923-7ab09e4f0e36', name: 'Amaan' },
    { id: 'fa4631a7-23f7-457b-ac53-f389c981d874', name: 'sreelekshmi' },
    { id: '7c8ea30e-7d0e-4f11-a031-b88ff31fe8e3', name: 'rishan' },
    { id: '7169a396-64c2-4656-a04d-ba5211ed6170', name: 'Mahir munawar' }
  ];

  const { data, error } = await supabase.from('leads').select('id, counselor_id').in('id', leads.map(l => l.id));
  if (error) console.error(error);
  else {
    console.log('Lead Counselor Mapping:');
    data.forEach(l => console.log(`Lead: ${l.id} -> Counselor: ${l.counselor_id}`));
  }
}

check();
