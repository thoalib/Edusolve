import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const leadId = 'b63a20a7-2130-4290-bb6d-fd77293e4169';

async function check() {
  console.log('\n--- Full Lead Data for Hithen Santh ---');
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();
  
  if (error) console.error('Error:', error);
  else console.log(data);
}

check();
