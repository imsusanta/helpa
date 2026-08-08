import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '../src/lib/whatsapp/encryption'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testDecryption() {
  const { data: configs } = await db
    .from('whatsapp_config')
    .select('account_id, access_token, phone_number_id')

  console.log('=== WHATSAPP CONFIGS DECRYPTION ===')
  for (const c of configs || []) {
    try {
      const dec = decrypt(c.access_token)
      console.log(`[PASS] Account ${c.account_id}: WhatsApp token decrypted successfully! (Length: ${dec.length}, Starts: ${dec.substring(0, 10)}...)`)
    } catch (err: any) {
      console.error(`[FAIL] Account ${c.account_id}: WhatsApp token decryption FAILED! Error: ${err.message}`)
      console.log(`Raw access_token in DB: ${c.access_token}`)
    }
  }

  console.log('\n=== ACCOUNTS OPENROUTER API KEYS DECRYPTION ===')
  const { data: accounts } = await db
    .from('accounts')
    .select('id, name, openrouter_api_key, openrouter_model')

  for (const a of accounts || []) {
    if (!a.openrouter_api_key) {
      console.log(`[WARN] Account ${a.id} (${a.name}): No OpenRouter API key configured in DB.`)
      continue
    }
    try {
      const dec = decrypt(a.openrouter_api_key)
      console.log(`[PASS] Account ${a.id} (${a.name}): OpenRouter API key decrypted successfully! (Starts: ${dec.substring(0, 10)}...)`)
    } catch (err: any) {
      console.error(`[FAIL] Account ${a.id} (${a.name}): OpenRouter API key decryption FAILED! Error: ${err.message}`)
      console.log(`Raw openrouter_api_key in DB: ${a.openrouter_api_key}`)
    }
  }
}

testDecryption()
