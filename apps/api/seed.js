import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or Key missing in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('notification_delivery_config').select('*');
    if (error) {
        console.log('Error fetching table:', error.message);
    } else {
        console.log('Table rows:', data);
        if (data.length === 0) {
            console.log('Inserting default events...');
            const events = [
                { event_type: 'ticket_created', push_enabled: true, in_app_enabled: true },
                { event_type: 'ticket_reply', push_enabled: true, in_app_enabled: true },
                { event_type: 'payment_verified', push_enabled: true, in_app_enabled: true },
                { event_type: 'payment_requested', push_enabled: true, in_app_enabled: true },
                { event_type: 'session_assigned', push_enabled: true, in_app_enabled: true },
                { event_type: 'new_lead', push_enabled: true, in_app_enabled: true },
                { event_type: 'general', push_enabled: true, in_app_enabled: true }
            ];
            const ins = await supabase.from('notification_delivery_config').insert(events);
            console.log('Insert result:', ins);
        }
    }
}
run();
