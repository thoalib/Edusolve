import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { error } = await supabase.from('session_verifications').update({ updated_at: new Date().toISOString() }).eq('id', '85f83ccf-78f3-4ae2-a654-7a9919f9915f');
  console.log("Update Error:", error);
}
run();
