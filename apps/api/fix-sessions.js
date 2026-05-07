import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Fetching approved sessions with mismatched durations...');
  
  const { data: verifications, error } = await supabase
    .from('session_verifications')
    .select('session_id, new_duration, academic_sessions!inner(id, duration_hours, status)')
    .eq('type', 'approval')
    .eq('status', 'approved')
    .not('new_duration', 'is', null);

  if (error) {
    console.error('Error fetching verifications:', error);
    return;
  }

  const toUpdate = verifications.filter(v => {
    return v.academic_sessions && 
           v.academic_sessions.status === 'completed' &&
           Number(v.new_duration) !== Number(v.academic_sessions.duration_hours);
  });

  console.log(`Found ${toUpdate.length} sessions that need fixing.`);

  let successCount = 0;
  for (const v of toUpdate) {
    const { error: updateError } = await supabase
      .from('academic_sessions')
      .update({ duration_hours: Number(v.new_duration) })
      .eq('id', v.session_id);

    if (updateError) {
      console.error(`Failed to update session ${v.session_id}:`, updateError);
    } else {
      successCount++;
    }
  }

  console.log(`Successfully fixed ${successCount} sessions.`);
}

run();
