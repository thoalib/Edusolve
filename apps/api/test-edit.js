import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: verifs } = await supabase.from('session_verifications').select('*').order('updated_at', { ascending: false }).limit(5);
  console.log("Recent verifications:");
  console.log(JSON.stringify(verifs, null, 2));

  const { data: ledger } = await supabase.from('hour_ledger').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("\nRecent ledger entries:");
  console.log(JSON.stringify(ledger, null, 2));
}
run();
