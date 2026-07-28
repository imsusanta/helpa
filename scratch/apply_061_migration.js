const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const sql = fs.readFileSync('supabase/migrations/061_hospital_followups.sql', 'utf8');
  
  // Try creating table via RPC or direct postgres query if rpc exists, or testing inserting sample row
  try {
    const { error } = await db.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.log('RPC exec_sql error (normal if no rpc):', error.message);
      // Fallback: create table directly via query or REST
    } else {
      console.log('Migration 061 executed via exec_sql');
    }
  } catch (e) {
    console.log('RPC error:', e.message);
  }

  // Test table existence
  const { data, error } = await db.from('hospital_followups').select('*').limit(1);
  if (error) {
    console.error('hospital_followups table not found yet:', error.message);
  } else {
    console.log('hospital_followups table exists and accessible!');
  }
}

runMigration();
