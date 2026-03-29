import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Listing ALL PRs with Lead names ---');
  const { data, error } = await supabase
    .from('payment_requests')
    .select('id, lead_id, created_at, leads(student_name)');
  
  if (error) console.error('Error:', error);
  else {
    console.log('Total PRs:', data.length);
    data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    data.forEach(r => {
      console.log(`${r.created_at} | PR: ${r.id} | Lead: ${r.lead_id} | Name: ${r.leads?.student_name}`);
    });
  }
}

check();
