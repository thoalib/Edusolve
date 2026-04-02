import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://jgihvgeglakjaldoizme.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnaWh2Z2VnbGFramFsZG9pem1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA2NDczNywiZXhwIjoyMDg2NjQwNzM3fQ.A6bhjD12S0imsm-hsJgLqjE6-sSs1Btv-5KIOk8Wqrs');
const { data, error } = await supabase.from('leads').select('*').limit(1);
if (data && data.length > 0) { console.log(Object.keys(data[0])); }
if (error) console.error(error);
