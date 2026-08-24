import { createClient } from '@supabase/supabase-js';
import { assertSafeDemoEnvironment, DEMO_IDS } from './demo-fixtures';

async function main() {
  const config = assertSafeDemoEnvironment();
  const database = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: membership, error: membershipError } = await database
    .from('account_members')
    .select('account_id')
    .eq('account_id', config.accountId)
    .eq('user_id', config.userId)
    .eq('active', true)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error('Demo account membership could not be verified');

  const deletions: Array<[string, readonly string[]]> = [
    ['reminder_jobs', DEMO_IDS.appointments],
    ['messages', DEMO_IDS.messages],
    ['appointments', DEMO_IDS.appointments],
    ['conversations', DEMO_IDS.conversations],
    ['contacts', DEMO_IDS.contacts],
    ['hospital_doctors', DEMO_IDS.doctors],
  ];

  for (const [table, ids] of deletions) {
    const column = table === 'reminder_jobs' ? 'appointment_id' : 'id';
    const { error } = await database.from(table).delete().in(column, [...ids]);
    if (error) throw new Error(`Failed to reset ${table}: ${error.message}`);
  }

  console.log(
    JSON.stringify(
      {
        status: 'reset',
        environment: config.environment,
        accountId: config.accountId,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
