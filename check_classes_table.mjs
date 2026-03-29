
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './apps/api/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    const { data, error } = await supabase
        .from('classes')
        .select('*')
        .limit(1);
    
    if (error) {
        if (error.code === '42P01') {
            console.log('Table "classes" does not exist.');
        } else {
            console.error('Error:', error.message);
        }
    } else {
        console.log('Table "classes" exists.');
    }
}

checkTable();
