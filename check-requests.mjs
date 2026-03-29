import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const leadId = 'b63a20a7-2130-4290-bb6d-fd77293e4169';

async function check() {
  console.log('\n--- Checking Requests Table for this Lead ---');
  const { data: requests, error: rError } = await supabase
    .from('requests')
    .select('*')
    .eq('lead_id', leadId);
  
  if (rError) console.error('Requests Error:', rError);
  else console.log('Requests:', requests);
}

check();
