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
  console.log('--- Checking Accounts AI Settings ---');
  const { data: accounts, error: accErr } = await supabaseAdmin
    .from('accounts')
    .select(
      'id, name, openrouter_api_key, openrouter_model, ai_system_prompt, industry'
    );

  if (accErr) {
    console.error('Error fetching accounts:', accErr);
    return;
  }

  console.log(`Found ${accounts?.length || 0} account(s):`);
  accounts?.forEach((a) => {
    console.log({
      id: a.id,
      name: a.name,
      hasApiKeyInDb: Boolean(a.openrouter_api_key),
      apiKeyPrefix: a.openrouter_api_key
        ? a.openrouter_api_key.substring(0, 10) + '...'
        : null,
      model: a.openrouter_model,
      industry: a.industry,
    });
  });

  console.log('\n--- Environment Variables ---');
  console.log(
    'OPENROUTER_API_KEY in process.env:',
    Boolean(process.env.OPENROUTER_API_KEY)
  );
  if (process.env.OPENROUTER_API_KEY) {
    console.log(
      'OPENROUTER_API_KEY prefix:',
      process.env.OPENROUTER_API_KEY.substring(0, 12) + '...'
    );
  }

  console.log('\n--- Checking Conversations AI Settings ---');
  const { data: conversations } = await supabaseAdmin
    .from('conversations')
    .select('id, account_id, ai_chat_enabled, contact_id, updated_at')
    .limit(5);

  console.log(
    `Found ${conversations?.length || 0} conversation(s):`,
    conversations
  );
}

main().catch(console.error);
