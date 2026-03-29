import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Checking for Triggers on payment_requests ---');
  const { data, error } = await supabase.rpc('get_triggers_for_table', { t_name: 'payment_requests' });
  
  if (error) {
    console.log('RPC get_triggers_for_table failed, trying SQL query...');
    const { data: data2, error: error2 } = await supabase.from('pg_trigger').select('tgname').eq('tgrelid', "'payment_requests'::regclass");
    if (error2) console.error('Error:', error2);
    else console.log('Triggers:', data2);
  } else {
    console.log('Triggers:', data);
  }
}

// Alternative way to check triggers if RPC fails
async function checkManual() {
  const { data, error } = await supabase.from('audit_logs').select('action').ilike('action', '%delete%').limit(10);
  if (error) console.error('Audit Error:', error);
  else console.log('Recent delete actions in audit_logs:', data);
}

check();
checkManual();
