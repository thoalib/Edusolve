/**
 * fix-long-student-codes.mjs
 * Finds and fixes student codes that have double-year prefix (e.g. MR0260260344 -> MR0260344).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = readFileSync('apps/api/.env', 'utf8');
for (const line of envFile.split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i<0) continue;
  process.env[t.slice(0,i).trim()] = t.slice(i+1).trim().replace(/^["']|["']$/g,'');
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: students } = await db
    .from('students')
    .select('id, student_code, student_name')
    .not('student_code', 'is', null);

  console.log(`\nChecking ${students?.length || 0} student codes...`);

  let fixedCount = 0;
  for (const s of students || []) {
    let currentCode = s.student_code || '';
    let newCode = currentCode;

    // A correct code is 9 chars (2 month + 0 + 2 year + 0 + 3 seq) 
    // Wait, the user said MR0260343 is old, which is 9 chars.
    // If it's MR0260260343, it's 12 chars.
    // Prefix is 6 chars e.g. "MR0260"
    // The "260" part repeats.
    
    if (currentCode.length > 9) {
      const prefix = currentCode.slice(0, 6); // "MR0260"
      const yearPart = prefix.slice(3, 6); // "260"
      
      // Repeatedly remove "260" from the start of the rest if it matches
      let rest = currentCode.slice(6);
      while (rest.startsWith(yearPart) && (rest.length > 3)) {
         rest = rest.slice(3);
      }
      newCode = prefix + rest;
      
      if (newCode !== currentCode) {
         console.log(`  🔧 Fixing: ${s.student_name} (${currentCode} -> ${newCode})`);
         const { error } = await db.from('students').update({ student_code: newCode }).eq('id', s.id);
         if (!error) fixedCount++;
         else console.error(`    ❌ Failed: ${s.student_name}: ${error.message}`);
      }
    }
  }

  console.log(`\n✅ Done! Fixed ${fixedCount} student codes.`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
