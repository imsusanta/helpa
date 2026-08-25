import { createClient } from '@supabase/supabase-js';
import {
  INDUSTRY_REGISTRY,
  resolveCanonicalIndustry,
} from '../src/modules/registry.ts';

const accountId = process.argv[2];
const apply = process.argv.includes('--apply');
if (!accountId || !/^[0-9a-f-]{36}$/i.test(accountId)) {
  throw new Error(
    'Usage: node scripts/repair-automation-seeds.mjs <account-id> [--apply]'
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
  );
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: account, error: accountError } = await db
  .from('accounts')
  .select('id, industry')
  .eq('id', accountId)
  .maybeSingle();
if (accountError) throw accountError;
if (!account) throw new Error(`Account ${accountId} was not found`);

const canonicalIndustry = resolveCanonicalIndustry(account.industry);
const allKnownWorkflowNames = new Set(
  Object.values(INDUSTRY_REGISTRY).flatMap((module) =>
    module.workflows.map((workflow) => workflow.name)
  )
);
const { data: automations, error: automationError } = await db
  .from('automations')
  .select('id, name, metadata, account_id')
  .eq('account_id', accountId);
if (automationError) throw automationError;

const seeded = (automations ?? []).filter(
  (automation) => automation.metadata?.helpa_seeded_workflow === true
);
const ambiguousLegacy = (automations ?? []).filter(
  (automation) =>
    !automation.metadata?.helpa_seeded_workflow &&
    allKnownWorkflowNames.has(automation.name)
);

console.log(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'dry-run',
      accountId,
      industry: account.industry,
      canonicalIndustry,
      markedSeedRows: seeded.map(({ id, name, metadata }) => ({
        id,
        name,
        metadata,
      })),
      ambiguousLegacyRows: ambiguousLegacy.map(({ id, name }) => ({
        id,
        name,
      })),
    },
    null,
    2
  )
);

if (!apply || seeded.length === 0) process.exit(0);

const seededIds = seeded.map((automation) => automation.id);
const { error: stepsError } = await db
  .from('automation_steps')
  .delete()
  .in('automation_id', seededIds);
if (stepsError) throw stepsError;

const { error: deleteError } = await db
  .from('automations')
  .delete()
  .eq('account_id', accountId)
  .in('id', seededIds);
if (deleteError) throw deleteError;

console.log(
  `Removed ${seededIds.length} explicitly marked seeded automation(s).`
);
console.log('Ambiguous legacy rows were reported and left untouched.');
