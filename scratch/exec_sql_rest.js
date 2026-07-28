const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeSql() {
  const sql = fs.readFileSync('supabase/migrations/061_hospital_followups.sql', 'utf8');

  // Send request to Supabase SQL query endpoint
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ sql })
  });

  console.log('Response status:', res.status);
  const text = await res.text();
  console.log('Response body:', text);
}

executeSql();
