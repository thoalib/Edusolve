import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Checking for payment requests with missing/broken leads ---');
  const { data, error } = await supabase
    .from('payment_requests')
    .select('id, lead_id, leads(id, student_name)');
  
  if (error) console.error('Error:', error);
  else {
    const broken = data.filter(r => !r.leads);
    console.log('Total PRs:', data.length);
    console.log('Broken PRs (no lead found):', broken.length);
    if (broken.length > 0) console.log('Broken PR Sample:', broken[0]);

    const targetLeadId = 'b63a20a7-2130-4290-bb6d-fd77293e4169';
    const byLeadId = data.filter(r => r.lead_id === targetLeadId);
    console.log(`PRs for target lead ${targetLeadId}:`, byLeadId.length);
  }
}

check();
