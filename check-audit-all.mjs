import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const leadId = 'b63a20a7-2130-4290-bb6d-fd77293e4169';

async function check() {
  const { data: auditLogs, error: aError } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', leadId)
    .order('created_at', { ascending: false });
  
  if (aError) console.error('Audit Error:', aError);
  else {
    console.log('Total audit logs:', auditLogs.length);
    auditLogs.forEach(l => {
        console.log(`Action: ${l.action} | Time: ${l.created_at} | Reason: ${l.reason}`);
    });
  }
}

check();
