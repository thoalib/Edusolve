import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sessionIds = [
    "294966a4-c4d9-46bc-bd73-aff09da74b48",
    "b8b8575b-8b28-4180-8653-f97d9da0c645",
    "25daeb7e-de6d-47ad-bf59-284a67c5bd0b",
    "44d189b2-8242-4678-8ac6-ec1c78609a68",
    "d6d39e75-1377-47ca-a80d-131dcce11bcf",
    "5a01799d-5a2c-4e15-b9a5-ba02c9cc62b3",
    "92249c1f-9b95-4be8-848a-2f85972d805d",
    "682a8fa6-ecbd-4ff6-bebb-6b0913301e19",
    "6996902f-786a-4c4b-95be-02a557307bb9",
    "0e01ab4e-b19c-4711-8bf5-b81e5395d2d8",
    "fabdf33f-8c77-427f-9527-8ac6a9efc60b" // from earlier logs (Amina)
  ];
  
  // See if hour_ledger has the original hours. 
  // When a session is approved, hour_ledger gets a student_debit entry. The hours_delta would be the duration that was approved.
  // Wait, the hour ledger is populated based on duration_hours at the time of approval.
  // What about before the approval? There's no other table.
  // Let's check what we have in hour_ledger for these.
  const { data, error } = await supabase.from('hour_ledger').select('*').in('session_id', sessionIds);
  console.log(data);
}
run();
