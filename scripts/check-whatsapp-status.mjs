import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseUrl } from './lib/supabase-target.mjs';

const supabaseUrl = resolveSupabaseUrl();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: configs } = await supabaseAdmin
    .from('whatsapp_config')
    .select('*');
  console.log('WhatsApp Config full object:', configs);
}

main().catch(console.error);
