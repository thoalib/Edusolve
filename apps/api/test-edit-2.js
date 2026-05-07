import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: ledger } = await supabase.from('hour_ledger').select('*').not('notes', 'is', null).order('created_at', { ascending: false }).limit(5);
  console.log("\nRecent ledger entries with notes:");
  console.log(JSON.stringify(ledger, null, 2));
}
run();
