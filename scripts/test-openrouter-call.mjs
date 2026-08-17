import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getEncryptionKeyBuffer() {
  const rawKey =
    process.env.ENCRYPTION_KEY ||
    '0000000000000000000000000000000000000000000000000000000000000000';
  return Buffer.from(rawKey, 'hex');
}

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  if (encryptedText.startsWith('sk-')) return encryptedText;
  const parts = encryptedText.split(':');
  if (parts.length === 3) {
    const [ivHex, ctHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKeyBuffer(),
      iv
    );
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ctHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  throw new Error('Invalid format');
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://tmqlzsyqlprioeoowmtk.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: account } = await supabaseAdmin
    .from('accounts')
    .select('openrouter_api_key, openrouter_model')
    .eq('id', '2a226a67-557e-4e57-bf3d-6de93992754c')
    .single();

  const apiKey = decrypt(account.openrouter_api_key);
  const modelToTest = account.openrouter_model;

  console.log(
    `Testing OpenRouter API call with model: ${modelToTest} and response_format: json_object`
  );

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://helpa.studio',
      'X-Title': 'Helpa Studio',
    },
    body: JSON.stringify({
      model: modelToTest,
      messages: [
        {
          role: 'system',
          content:
            'You must respond ONLY with a raw JSON object with keys "reply" and "intent".',
        },
        { role: 'user', content: 'Hi, what are your clinic hours?' },
      ],
      temperature: 0.3,
      max_tokens: 450,
      response_format: { type: 'json_object' },
    }),
  });

  const responseText = await res.text();
  console.log('HTTP Status:', res.status);
  console.log('Response Body:', responseText);
}

main().catch(console.error);
