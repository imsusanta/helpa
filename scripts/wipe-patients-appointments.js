// Script to wipe all patients & appointments data and reset sequences
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function wipeData() {
  console.log('🗑️  Wiping all patient & appointment data...\n');

  // 1. Delete in dependency order (child tables first)
  const tables = [
    'appointments_feedback',
    'billing_invoices', 
    'lab_reports',
    'appointments',
    'patients',
  ];

  for (const table of tables) {
    const { error, count } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`  ❌ Error deleting from ${table}:`, error.message);
    } else {
      console.log(`  ✅ Deleted all rows from ${table}`);
    }
  }

  // 2. Reset sequences via raw SQL using supabase rpc
  // Since we can't run raw SQL via REST easily, we'll verify counts instead
  console.log('\n📊 Verifying tables are empty...');
  for (const table of tables) {
    const { count } = await db.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${count} rows`);
  }

  console.log('\n✅ Data wipe complete!');
  console.log('⚠️  Note: Run the following SQL in the Supabase SQL Editor to reset sequences:');
  console.log('  ALTER SEQUENCE patient_seq_id_sequence RESTART WITH 10001;');
  console.log('  ALTER SEQUENCE appointment_seq RESTART WITH 10001;');
}

wipeData().catch(console.error);
