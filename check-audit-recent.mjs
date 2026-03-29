import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const leadId = 'b63a20a7-2130-4290-bb6d-fd77293e4169';

async function check() {
  const { data: auditLogs, error: aError } = await supabase
    .from('audit_logs')
    .select('action, created_at, before_data->status as from_status, after_data->status as to_status, reason')
    .eq('entity_id', leadId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (aError) console.error('Audit Error:', aError);
  else console.log('Audit Logs:', auditLogs);
}

check();
