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
  console.log('--- Inspecting Conversation Messages ---');
  const { data: messages, error } = await supabaseAdmin
    .from('messages')
    .select(
      'id, conversation_id, sender_type, content_text, created_at, status'
    )
    .eq('conversation_id', '59a3bbbc-2fcc-4472-869f-946de7252a09')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  console.log(`Found ${messages?.length || 0} message(s):`);
  messages?.forEach((m) => {
    console.log(
      `- [${m.created_at}] ${m.sender_type}: "${m.content_text}" (Status: ${m.status})`
    );
  });
}

main().catch(console.error);
