import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Listing all tables in public schema ---');
  // Hacky way to list tables via rpc if possible, but let's just try to query them
  const tables = [
    'leads', 
    'payment_requests', 
    'lead_status_history', 
    'audit_logs', 
    'requests',
    'student_topups',
    'hr_payment_requests'
  ];
  
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) console.log(`${table}: ERROR ${error.message}`);
    else console.log(`${table}: ${count} records`);
  }
}

check();
