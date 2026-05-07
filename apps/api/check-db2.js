import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: verif } = await supabase.from('session_verifications').select('*').eq('session_id', '2a65b0e0-fd34-4ee7-90c5-bb59143d04ad');
  console.log("Verification row:", JSON.stringify(verif, null, 2));
}
run();
