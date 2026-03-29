import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Listing ALL PR IDs and Lead IDs ---');
  const { data, error } = await supabase
    .from('payment_requests')
    .select('id, lead_id, created_at, requested_by');
  
  if (error) console.error('Error:', error);
  else {
    console.log('Total PRs:', data.length);
    const targetLeadId = 'b63a20a7-2130-4290-bb6d-fd77293e4169';
    const match = data.find(r => r.lead_id === targetLeadId);
    if (match) console.log('MATCH FOUND:', match);
    else console.log('No direct lead_id match found.');
  }
}

check();
