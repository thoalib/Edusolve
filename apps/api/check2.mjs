import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: users } = await admin.from('users').select('id, email, full_name, is_active').ilike('email', '%%councelor%%').or('email.ilike.*counselor*');
  console.log('Users with counselor in email:', users);
  
  const { data: allUsers } = await admin.from('users').select('id, email, full_name');
  const manualCheck = allUsers.filter(u => u.email.includes('c-') || u.email.includes('counselor') || u.full_name?.toLowerCase().includes('counselor'));
  console.log('Potential counselor users:', manualCheck);
  
  const { data: userRoles } = await admin.from('user_roles').select('*, roles(code)');
  console.log('User roles for potential counselors:', manualCheck.map(u => ({
    email: u.email,
    roles: userRoles.filter(ur => ur.user_id === u.id).map(ur => ur.roles?.code)
  })));
}
check().catch(console.error);
