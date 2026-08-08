const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(supabaseUrl, supabaseKey);

async function inspectConversations() {
  const { data: row, error: rowErr } = await db.from('conversations').select('*').limit(1);
  if (row && row[0]) {
    console.log('Conversations sample keys:', Object.keys(row[0]));
    console.log('Sample row:', row[0]);
  } else {
    console.log('Error or empty row:', rowErr);
  }
}

inspectConversations();
