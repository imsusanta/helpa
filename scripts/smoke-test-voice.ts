import { ElevenLabsVoiceProvider } from '../src/core/providers/voice/elevenlabs-provider';

async function runVoiceSmokeTest() {
  const isExecute = process.argv.includes('--execute');

  console.log('🎙️ Voice Agent Provider Smoke-Test Diagnostic Tool');
  console.log('----------------------------------------------------');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const phoneId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

  console.log(
    `Configured API Key: ${apiKey ? '[PRESENT (Redacted)]' : '[MISSING]'}`
  );
  console.log(`Configured Agent ID: ${agentId || '[UNSET]'}`);
  console.log(`Configured Phone Number ID: ${phoneId || '[UNSET]'}`);

  const provider = new ElevenLabsVoiceProvider({
    apiKey,
    agentId,
    phoneNumberId: phoneId,
  });

  console.log('\n🔍 Performing Provider Health Check...');
  const health = await provider.healthCheck();

  console.log('Health Check Results:');
  console.log(`  - Configured: ${health.configured}`);
  console.log(`  - Credentials Valid: ${health.credentialsValid}`);
  console.log(`  - Provider Reachable: ${health.providerReachable}`);
  console.log(`  - Agent Found: ${health.agentFound}`);
  console.log(`  - Phone Number Found: ${health.phoneNumberFound}`);

  if (!isExecute) {
    console.log('\nℹ️ Running in DRY-RUN mode.');
    console.log('To initiate a live test call boundary check, run with:');
    console.log(
      '  npx tsx -r dotenv/config scripts/smoke-test-voice.ts dotenv_config_path=.env.local --execute\n'
    );
    return;
  }

  if (!health.credentialsValid) {
    console.error(
      '\n❌ Cannot execute live outbound call test: Invalid or missing provider credentials.'
    );
    process.exit(1);
  }

  console.log(
    '\n🚀 --execute flag detected. Executing live configuration listing...'
  );
  try {
    const agents = await provider.listAgents();
    console.log(`✅ Found ${agents.length} configured agent(s) on ElevenLabs.`);
    agents.forEach((a) => console.log(`   - Agent: ${a.name} (ID: ${a.id})`));

    const numbers = await provider.listPhoneNumbers();
    console.log(`✅ Found ${numbers.length} configured phone number(s).`);
    numbers.forEach((n) =>
      console.log(`   - Phone ID: ${n.id} (${n.phoneNumberMasked})`)
    );

    console.log(
      '\n✅ Voice Smoke-Test Diagnostic Complete. All provider boundaries verified.'
    );
  } catch (err) {
    console.error('\n❌ Smoke-test execution failed:', err);
    process.exit(1);
  }
}

runVoiceSmokeTest().catch((err) => {
  console.error('Fatal smoke test error:', err);
  process.exit(1);
});
