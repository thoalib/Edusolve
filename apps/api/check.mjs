import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: roles } = await admin.from('roles').select('*');
  const roleMap = {};
  for (const r of roles) roleMap[r.id] = r.code;

  const { data: userRoles } = await admin.from('user_roles').select('user_id, role_id');
  
  const counts = {};
  const counselors = [];
  const activeCounselors = [];
  
  for (const ur of userRoles) {
    const code = roleMap[ur.role_id];
    if (code === 'counselor') {
      counselors.push(ur.user_id);
    }
    counts[code] = (counts[code] || 0) + 1;
  }
  
  const { data: users } = await admin.from('users').select('id, email, is_active').in('id', counselors);
  
  console.log('Role counts:', counts);
  console.log('Counselors in DB:', users);
}
check().catch(console.error);
