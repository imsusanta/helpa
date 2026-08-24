import { createClient } from '@supabase/supabase-js';
import {
  assertSafeDemoEnvironment,
  buildDemoRows,
  DEMO_SEED_MARKER,
} from './demo-fixtures';

async function main() {
  const config = assertSafeDemoEnvironment();
  const database = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: membership, error: membershipError } = await database
    .from('account_members')
    .select('account_id, user_id, role, active')
    .eq('account_id', config.accountId)
    .eq('user_id', config.userId)
    .eq('active', true)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) {
    throw new Error(
      'The supplied DEMO_USER_ID is not an active member of DEMO_ACCOUNT_ID'
    );
  }

  const fixtures = buildDemoRows(config);
  const batches: Array<[string, Array<Record<string, unknown>>]> = [
    ['hospital_doctors', fixtures.doctors],
    ['contacts', fixtures.contacts],
    ['conversations', fixtures.conversations],
    ['messages', fixtures.messages],
    ['appointments', fixtures.appointments],
  ];

  for (const [table, rows] of batches) {
    const { error } = await database
      .from(table)
      .upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`Failed to seed ${table}: ${error.message}`);
  }

  console.log(
    JSON.stringify(
      {
        status: 'seeded',
        marker: DEMO_SEED_MARKER,
        environment: config.environment,
        accountId: config.accountId,
        counts: Object.fromEntries(
          Object.entries(fixtures).map(([name, rows]) => [name, rows.length])
        ),
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
