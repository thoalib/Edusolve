import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n--- Checking for ALL audit logs around target time ---');
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .gte('created_at', '2026-03-26T17:15:00Z')
    .lte('created_at', '2026-03-26T17:25:00Z');
  
  if (error) console.error('Error:', error);
  else {
    console.log('Total entries:', data.length);
    data.forEach(l => {
      console.log(`${l.created_at} | ${l.actor_id} | ${l.action} | ${l.entity_type}:${l.entity_id}`);
    });
  }
}

check();
