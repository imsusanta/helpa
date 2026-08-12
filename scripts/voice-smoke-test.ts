import { ElevenLabsVoiceProvider } from '../src/core/providers/voice/elevenlabs-provider';

function redact(val: string | undefined): string {
  if (!val) return '[NOT_SET]';
  if (val.length <= 6) return '***';
  return `${val.slice(0, 3)}***${val.slice(-3)}`;
}

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const confirmArg = args.find((a) => a.startsWith('--confirm='));
  const isConfirmed = confirmArg === '--confirm=PLACE_REAL_CALL';

  console.log('🎙️ === ElevenLabs Voice Agent Smoke Test ===');
  console.log(
    `Execution Mode: ${isExecute ? 'LIVE CALL EXECUTION' : 'READ-ONLY DIAGNOSTIC'}`
  );

  if (process.env.CI) {
    console.error(
      '❌ Error: Voice smoke test execution is disabled in CI environments.'
    );
    process.exit(1);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;

  console.log('\n--- Environment Check ---');
  console.log(`ELEVENLABS_API_KEY:        ${redact(apiKey)}`);
  console.log(`ELEVENLABS_AGENT_ID:        ${redact(agentId)}`);
  console.log(`ELEVENLABS_PHONE_NUMBER_ID: ${redact(phoneNumberId)}`);
  console.log(`ELEVENLABS_WEBHOOK_SECRET:  ${redact(webhookSecret)}`);

  if (!apiKey) {
    console.warn(
      '\n⚠️ ELEVENLABS_API_KEY is not configured. Diagnostic cannot reach remote provider.'
    );
    process.exit(0);
  }

  const provider = new ElevenLabsVoiceProvider();

  try {
    console.log('\n--- Fetching Remote Provider Agents ---');
    const agents = await provider.listAgents();
    console.log(`Found ${agents.length} agent(s):`);
    for (const agent of agents) {
      console.log(` - Name: "${agent.name}", ID: ${redact(agent.id)}`);
    }

    console.log('\n--- Fetching Remote Provider Phone Numbers ---');
    const numbers = await provider.listPhoneNumbers();
    console.log(`Found ${numbers.length} phone number(s):`);
    for (const num of numbers) {
      console.log(
        ` - ID: ${redact(num.id)}, Masked Phone: ${num.phoneNumberMasked}`
      );
    }

    console.log('\n--- Running Health Check ---');
    const health = await provider.healthCheck();
    console.log(`Configured:        ${health.configured}`);
    console.log(`Credentials Valid: ${health.credentialsValid}`);
    console.log(`Provider Reachable:${health.providerReachable}`);
    console.log(`Agent Found:       ${health.agentFound}`);
    console.log(`Phone Found:       ${health.phoneNumberFound}`);

    if (!isExecute) {
      console.log('\n✅ Read-only smoke test completed successfully.');
      console.log('To execute a real outbound call, run:');
      console.log(
        '  TEST_VOICE_TO_NUMBER="+1234567890" npm run voice:smoke -- --execute --confirm=PLACE_REAL_CALL\n'
      );
      return;
    }

    if (!isConfirmed) {
      console.error(
        '\n❌ Live call refused: Missing required flag --confirm=PLACE_REAL_CALL'
      );
      process.exit(1);
    }

    const toNumber = process.env.TEST_VOICE_TO_NUMBER;
    if (!toNumber) {
      console.error(
        '\n❌ Live call refused: TEST_VOICE_TO_NUMBER environment variable is required'
      );
      process.exit(1);
    }

    console.log(`\n🚀 Placing live outbound call to ${redact(toNumber)}...`);
    const result = await provider.initiateOutboundCall({
      toNumber,
      agentId,
      phoneNumberId,
    });

    console.log(`✅ Outbound call initiated successfully!`);
    console.log(`   External Call ID: ${redact(result.externalCallId)}`);
  } catch (err: unknown) {
    console.error(
      '\n❌ Smoke test encountered an error:',
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }
}

main();
