import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { triggerAiResponse } from '../src/lib/whatsapp/ai.js';
import { resolveSupabaseUrl } from './lib/supabase-target.mjs';

const supabaseUrl = resolveSupabaseUrl();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('Inserting test customer message...');
  const { data: insertedMsg, error: insertErr } = await db
    .from('messages')
    .insert({
      conversation_id: '59a3bbbc-2fcc-4472-869f-946de7252a09',
      sender_type: 'customer',
      content_type: 'text',
      content_text: 'What doctors are available in your clinic?',
      status: 'delivered',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) {
    console.error('Insert error:', insertErr);
    return;
  }
  console.log('Inserted customer message ID:', insertedMsg.id);

  console.log('\nRunning triggerAiResponse...');
  await triggerAiResponse({
    accountId: '2a226a67-557e-4e57-bf3d-6de93992754c',
    userId: '81a67e58-3bff-4f25-bf70-fb4fb7197341',
    conversationId: '59a3bbbc-2fcc-4472-869f-946de7252a09',
    contactId: '7c0c753b-5a72-4cca-bc25-433b805d9b86',
  });
  console.log('\nCompleted triggerAiResponse execution!');
}

main().catch(console.error);
