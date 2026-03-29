import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Listing all available tables via information_schema ---');
  const { data, error } = await supabase.rpc('list_tables');
  
  if (error) {
    console.log('RPC list_tables failed, trying manual list...');
    // I already did a manual list, but maybe I missed some
  } else {
    console.log('Tables:', data);
  }
}

check();
