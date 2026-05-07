import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('session_verifications')
    .select('session_id, new_duration, academic_sessions!inner(id, session_date, duration_hours, status, students(student_name), users!academic_sessions_teacher_id_fkey(full_name))')
    .eq('type', 'approval')
    .eq('status', 'approved')
    .not('new_duration', 'is', null);

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  // We are looking for ones that WERE fixed. 
  // Wait, if they were fixed, duration_hours now equals new_duration.
  // How do we know which ones were fixed? 
  // We can just show some of the Amina faiqah ones that I noticed earlier, 
  // or generally explain what was changed. 
  // Let me just fetch all sessions where new_duration is not null and equals duration_hours, 
  // and status is completed.
  
  const fixed = data.filter(v => v.academic_sessions && v.academic_sessions.status === 'completed' && Number(v.new_duration) === Number(v.academic_sessions.duration_hours));
  
  // Sort by date descending
  fixed.sort((a,b) => new Date(b.academic_sessions.session_date) - new Date(a.academic_sessions.session_date));
  
  console.log(JSON.stringify(fixed.slice(0, 10), null, 2));
}

run();
