import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { triggerAiResponse } from '../src/lib/whatsapp/ai.js';

async function main() {
  console.log('Testing triggerAiResponse...');
  try {
    await triggerAiResponse({
      accountId: '2a226a67-557e-4e57-bf3d-6de93992754c',
      userId: '81a67e58-3bff-4f25-bf70-fb4fb7197341',
      conversationId: '59a3bbbc-2fcc-4472-869f-946de7252a09',
      contactId: '7c0c753b-5a72-4cca-bc25-433b805d9b86',
    });
    console.log('triggerAiResponse finished!');
  } catch (err) {
    console.error('triggerAiResponse Error:', err);
  }
}

main().catch(console.error);
