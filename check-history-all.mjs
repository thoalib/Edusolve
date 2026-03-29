import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Status History with to_status: payment_verification ---');
  const { data, error } = await supabase
    .from('lead_status_history')
    .select('*, leads(student_name)')
    .eq('to_status', 'payment_verification')
    .order('created_at', { ascending: false });
  
  if (error) console.error('Error:', error);
  else {
    console.log('Total entries:', data.length);
    data.forEach(h => {
      console.log(`${h.created_at} | ${h.lead_id} | ${h.leads?.student_name} | ${h.reason}`);
    });
  }
}

check();
