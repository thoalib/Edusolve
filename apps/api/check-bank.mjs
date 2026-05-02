import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('teacher_profiles')
    .select('id, user_id, account_holder_name, account_number, gpay_number')
    .eq('is_in_pool', true)
    .limit(5);
    
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}

check();
