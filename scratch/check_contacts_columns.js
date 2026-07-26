const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/susantalohar/Documents/wacrm/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error("Error querying contacts:", error);
  } else {
    console.log("Columns in contacts:", Object.keys(data[0] || {}));
  }
}

check();
