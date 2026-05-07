import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: verifications } = await supabase
    .from('session_verifications')
    .select('session_id, new_duration, academic_sessions!inner(id, duration_hours, status)')
    .eq('type', 'approval')
    .eq('status', 'approved')
    .not('new_duration', 'is', null);

  // For all approved sessions with a new_duration
  for (const v of verifications) {
    if (!v.academic_sessions || v.academic_sessions.status !== 'completed') continue;
    
    // Find the hour ledger entry
    const { data: ledgerEntries } = await supabase
      .from('hour_ledger')
      .select('hours_delta')
      .eq('session_id', v.session_id)
      .eq('entry_type', 'teacher_credit')
      .limit(1);

    if (ledgerEntries && ledgerEntries.length > 0) {
      const originalDuration = ledgerEntries[0].hours_delta;
      if (Number(originalDuration) !== Number(v.academic_sessions.duration_hours)) {
        console.log(`Rolling back session ${v.session_id} from ${v.academic_sessions.duration_hours} to ${originalDuration}`);
        await supabase
          .from('academic_sessions')
          .update({ duration_hours: originalDuration })
          .eq('id', v.session_id);
      }
    }
  }
  console.log("Rollback complete.");
}
run();
