import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { triggerAiResponse } from '../src/lib/whatsapp/ai'

async function testAi() {
  console.log('[Test] Triggering AI response for conversation c6cc8127-a207-4449-9323-d4b479f354b1...')
  try {
    await triggerAiResponse({
      accountId: '75d961f4-6871-43c5-9f32-85a2bffa9192',
      userId: '7b492add-0005-4fc4-8a24-93adadb0fc4d',
      conversationId: 'c6cc8127-a207-4449-9323-d4b479f354b1',
      contactId: '1b434dbf-51dd-4b24-8149-a686a9099cba'
    })
    console.log('[Test] triggerAiResponse completed successfully!')
  } catch (err) {
    console.error('[Test] triggerAiResponse error:', err)
  }
}

testAi()
