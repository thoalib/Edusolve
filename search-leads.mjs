import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const name = 'HITHEN SANTH';

async function check() {
  console.log(`\n--- Searching for leads with name ${name} ---`);
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .ilike('student_name', `%${name}%`);
  
  if (error) console.error('Error:', error);
  else {
    console.log('Matches:', data.length);
    data.forEach(l => {
      console.log(`${l.id} | ${l.student_name} | status: ${l.status}`);
    });
  }
}

check();
