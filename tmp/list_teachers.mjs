import { getSupabaseAdminClient } from '../apps/api/src/config/supabase.js';
import 'dotenv/config';

async function listTeachers() {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    console.error('Supabase admin client not configured');
    process.exit(1);
  }

  const { data, error } = await adminClient
    .from('teacher_profiles')
    .select('user_id, teacher_code, users(email, full_name)')
    .limit(10);

  if (error) {
    console.error('Error fetching teachers:', error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

listTeachers();
