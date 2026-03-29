
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data, error } = await supabase.from('boards').select('*').limit(1);
    if (error) {
        console.error(error);
    } else {
        console.log('Columns in boards:', Object.keys(data[0] || {}));
    }
}
inspect();
