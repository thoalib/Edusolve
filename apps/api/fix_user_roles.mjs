import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  // 1. Get all roles
  const { data: roles } = await admin.from('roles').select('*');
  const roleCodeToId = {};
  for (const r of roles) roleCodeToId[r.code] = r.id;

  // 2. Get all auth users
  const { data: { users } } = await admin.auth.admin.listUsers();
  
  // 3. Get existing user_roles
  const { data: existingRoles } = await admin.from('user_roles').select('*');
  const existingSet = new Set(existingRoles.map(ur => `${ur.user_id}_${ur.role_id}`));

  // 4. Find missing roles
  const toInsert = [];
  for (const u of users) {
    const roleCode = u.app_metadata?.role || u.user_metadata?.role;
    if (roleCode && roleCode !== 'unknown') {
      const roleId = roleCodeToId[roleCode];
      if (roleId) {
        if (!existingSet.has(`${u.id}_${roleId}`)) {
          toInsert.push({ user_id: u.id, role_id: roleId });
          console.log(`Will add role ${roleCode} for user ${u.email}`);
        }
      }
    }
  }

  // 5. Insert missing roles
  if (toInsert.length > 0) {
    const { error } = await admin.from('user_roles').insert(toInsert);
    if (error) console.error("Error inserting roles:", error);
    else console.log(`Successfully added ${toInsert.length} user roles.`);
  } else {
    console.log("No missing roles found.");
  }
}

fix().catch(console.error);
