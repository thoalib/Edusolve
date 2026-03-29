import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Reading column names for payment_requests ---');
  const { data, error } = await supabase.from('payment_requests').select('*').limit(1);
  if (error) console.error('Error:', error);
  else {
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('No data in payment_requests to read columns.');
    }
  }
}

check();
