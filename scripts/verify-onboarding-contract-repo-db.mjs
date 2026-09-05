/**
 * scripts/verify-onboarding-contract-repo-db.mjs
 *
 * Full integration verification of the onboarding completion contract
 * against the actual repository database schema (helpa_repo_test_db).
 *
 * Validates:
 * 1. Schema invariants & trigger presence
 * 2. Fail-closed field protection (authenticated, anon, JWT claims, missing claims)
 * 3. Legitimate user profile edits preserved under authenticated role + RLS
 * 4. Single-transaction atomic RPC with all helper writes (pipelines, stages, KB, campaigns, automations, steps)
 * 5. Idempotent lost-response retry (status='already_completed', mutated=false)
 * 6. User-authored data preservation (draft campaigns, custom FAQs)
 * 7. Concurrent submission safety
 */

import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const DB_HOST = '127.0.0.1';
const DB_NAME = 'helpa_repo_test_db';

function execSql(sql) {
  try {
    const stdout = execFileSync(
      'psql',
      [
        '-h',
        DB_HOST,
        '-d',
        DB_NAME,
        '-v',
        'ON_ERROR_STOP=1',
        '-v',
        'VERBOSITY=verbose',
        '-c',
        sql,
      ],
      {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    return { success: true, stdout: stdout.trim() };
  } catch (err) {
    return {
      success: false,
      code: err.status,
      stderr: (err.stderr || err.message || '').toString(),
    };
  }
}

function queryJson(sql) {
  const wrappedSql = `WITH t AS (${sql.trim().replace(/;+$/, '')}) SELECT json_agg(t) FROM t;`;
  try {
    const stdout = execFileSync(
      'psql',
      [
        '-h',
        DB_HOST,
        '-d',
        DB_NAME,
        '-v',
        'ON_ERROR_STOP=1',
        '-t',
        '-A',
        '-c',
        wrappedSql,
      ],
      {
        encoding: 'utf8',
      }
    );
    const trimmed = stdout.trim();
    if (!trimmed || trimmed === '') return [];
    return JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Query failed: ${err.stderr || err.message}\nSQL: ${sql}`);
  }
}

function runAsyncPsql(sql) {
  return new Promise((resolve) => {
    const child = spawn('psql', [
      '-h',
      DB_HOST,
      '-d',
      DB_NAME,
      '-v',
      'ON_ERROR_STOP=1',
      '-t',
      '-A',
      '-c',
      sql,
    ]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('close', (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function createTestWorkspace(prefix) {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const userRows = queryJson(`
    INSERT INTO auth.users (id, email)
    VALUES (gen_random_uuid(), '${email}')
    RETURNING id;
  `);
  const userId = userRows[0].id;

  const accRows = queryJson(`
    SELECT id, name, owner_user_id, status, onboarding_completed_at, onboarding_exempted_at
    FROM public.accounts
    WHERE owner_user_id = '${userId}';
  `);
  if (!accRows || accRows.length === 0) {
    throw new Error(
      `Failed to retrieve account bootstrapped for user ${userId}`
    );
  }
  return { userId, accountId: accRows[0].id, account: accRows[0] };
}

async function verifyRepoDb() {
  console.log(
    '================================================================'
  );
  console.log('VERIFYING ONBOARDING COMPLETION CONTRACT ON REPOSITORY SCHEMA');
  console.log('Database: ' + DB_NAME + ' (PostgreSQL 16)');
  console.log(
    '================================================================\n'
  );

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Schema Invariants
  console.log('--- 1. Verifying Schema Invariants ---');
  const guardRows = queryJson(
    'SELECT id, deployment_cutoff, deployed_at FROM public.migration_onboarding_guard WHERE id = 1'
  );
  assert(
    guardRows.length === 1,
    'migration_onboarding_guard table exists with row id=1'
  );
  assert(
    guardRows[0].deployment_cutoff !== null,
    'deployment_cutoff timestamp is persisted'
  );

  const columns = queryJson(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'accounts' 
      AND column_name IN ('onboarding_completed_at', 'onboarding_exempted_at', 'onboarding_exemption_reason')
  `);
  assert(
    columns.length === 3,
    'accounts table contains all 3 onboarding tracking columns'
  );

  const rpcExists = queryJson(`
    SELECT routine_name, security_type 
    FROM information_schema.routines 
    WHERE routine_name = 'complete_workspace_onboarding' AND routine_schema = 'public'
  `);
  assert(
    rpcExists.length === 1 && rpcExists[0].security_type === 'DEFINER',
    'complete_workspace_onboarding RPC exists with SECURITY DEFINER'
  );

  // 2. Field Protection Trigger (Fail-Closed)
  console.log('\n--- 2. Verifying Fail-Closed Field Protection ---');
  const ws1 = createTestWorkspace('field_protect');
  const testAcc1 = ws1.accountId;
  assert(
    ws1.account.onboarding_completed_at === null,
    'New signup account has onboarding_completed_at = NULL'
  );
  assert(
    ws1.account.onboarding_exempted_at === null,
    'New signup account has onboarding_exempted_at = NULL'
  );
  assert(
    ws1.account.status === 'active',
    'New signup account status = active (operational standing)'
  );

  // Direct UPDATE of onboarding_completed_at by authenticated owner on own account -> BLOCKED by trigger
  const authUpdate = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
    SET LOCAL "request.jwt.claim.sub" = '${ws1.userId}';
    UPDATE public.accounts SET onboarding_completed_at = now() WHERE id = '${testAcc1}';
    COMMIT;
  `);
  assert(
    !authUpdate.success && authUpdate.stderr.includes('42501'),
    'Untrusted authenticated role UPDATE of onboarding_completed_at blocked by trigger (42501)'
  );

  // Direct UPDATE of onboarding_exempted_at by authenticated owner on own account -> BLOCKED by trigger
  const authExemptUpdate = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
    SET LOCAL "request.jwt.claim.sub" = '${ws1.userId}';
    UPDATE public.accounts SET onboarding_exempted_at = now() WHERE id = '${testAcc1}';
    COMMIT;
  `);
  assert(
    !authExemptUpdate.success && authExemptUpdate.stderr.includes('42501'),
    'Untrusted authenticated role UPDATE of onboarding_exempted_at blocked by trigger (42501)'
  );

  // Missing JWT role claims with authenticated user -> BLOCKED by trigger (fail closed)
  const missingClaimUpdate = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    SET LOCAL "request.jwt.claim.sub" = '${ws1.userId}';
    UPDATE public.accounts SET onboarding_completed_at = now() WHERE id = '${testAcc1}';
    COMMIT;
  `);
  assert(
    !missingClaimUpdate.success && missingClaimUpdate.stderr.includes('42501'),
    'Missing JWT claims with authenticated role blocked by trigger (42501)'
  );

  // Direct UPDATE by anon role -> BLOCKED by RLS
  const anonUpdate = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'anon';
    SET LOCAL "request.jwt.claim.role" = 'anon';
    UPDATE public.accounts SET onboarding_exempted_at = now() WHERE id = '${testAcc1}';
    COMMIT;
  `);
  assert(
    anonUpdate.success && anonUpdate.stdout.includes('UPDATE 0'),
    'Anon role cannot touch any account rows (RLS blocks row access)'
  );

  // Direct RPC execution by authenticated role -> BLOCKED
  const authRpc = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
    SET LOCAL "request.jwt.claim.sub" = '${ws1.userId}';
    SELECT public.complete_workspace_onboarding('${testAcc1}', '${ws1.userId}', 'hospital_clinic');
    COMMIT;
  `);
  assert(
    !authRpc.success &&
      (authRpc.stderr.includes('42501') ||
        authRpc.stderr.includes('permission denied')),
    'Direct RPC call by authenticated role blocked'
  );

  // Legitimate profile update by authenticated role -> ALLOWED
  const legitUpdate = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
    SET LOCAL "request.jwt.claim.sub" = '${ws1.userId}';
    UPDATE public.accounts SET name = 'Legitimately Updated Name' WHERE id = '${testAcc1}';
    COMMIT;
  `);
  assert(
    legitUpdate.success,
    'Legitimate account profile update (name) by authenticated role allowed'
  );

  // 3. Single-Transaction Atomic Onboarding RPC on Full Schema
  console.log(
    '\n--- 3. Testing Single-Transaction Atomic RPC on Real Schema ---'
  );
  const ws2 = createTestWorkspace('atomic_onboard');
  const testAcc2 = ws2.accountId;
  const testUserId = ws2.userId;

  // Seed user custom draft broadcast & custom FAQ to verify preservation
  const userBroadcastRes = execSql(`
    INSERT INTO public.broadcasts (account_id, user_id, name, template_name, status) 
    VALUES ('${testAcc2}', '${testUserId}', 'Tenant Draft Summer Promo', 'custom', 'draft');
  `);
  assert(userBroadcastRes.success, 'Pre-seeding user draft broadcast succeeds');

  const userFaqRes = execSql(`
    INSERT INTO public.knowledge_base (account_id, category, question_title, answer_content) 
    VALUES ('${testAcc2}', 'faq', 'Is wheelchair access available?', 'Yes, ramps and elevator available.');
  `);
  assert(userFaqRes.success, 'Pre-seeding user custom FAQ succeeds');

  const stagesJson = JSON.stringify([
    { name: 'Inquiry', position: 0, color: '#3b82f6' },
    { name: 'Scheduled', position: 1, color: '#10b981' },
    { name: 'Completed', position: 2, color: '#6366f1' },
  ]);

  const kbJson = JSON.stringify([
    {
      category: 'pricing',
      question_title: 'OPD Consultation Fee',
      answer_content: 'OPD consultation is ₹500.',
    },
    {
      category: 'company',
      question_title: 'Clinic Hours',
      answer_content: 'Open Mon-Sat 9AM-8PM.',
    },
  ]);

  const campaignsJson = JSON.stringify([
    {
      name: 'Seasonal Health Checkup',
      category: 'health',
      message_body: 'Book your annual health checkup.',
    },
  ]);

  const workflowsJson = JSON.stringify([
    {
      name: 'Appointment Reminder Workflow',
      description: 'Sends automated WhatsApp reminder 24h prior',
      trigger_type: 'appointment_scheduled',
      trigger_config: {},
      is_active: true,
      seed_key: 'appointment_reminder',
      steps: [
        {
          step_type: 'send_message',
          step_config: { template: 'reminder_24h' },
        },
      ],
    },
  ]);

  const rpcCallSql = `
    SELECT public.complete_workspace_onboarding(
      '${testAcc2}',
      '${testUserId}',
      'hospital_clinic',
      'Apollo Healthcare Clinic',
      NULL,
      'You are Apollo Healthcare assistant',
      'Welcome to Apollo Healthcare',
      ARRAY['hospital_clinic', 'real_estate', 'salon']::text[],
      '${stagesJson.replace(/'/g, "''")}'::jsonb,
      '${kbJson.replace(/'/g, "''")}'::jsonb,
      '${campaignsJson.replace(/'/g, "''")}'::jsonb,
      '${workflowsJson.replace(/'/g, "''")}'::jsonb
    ) as result;
  `;

  const rpcResult = queryJson(rpcCallSql)[0].result;
  assert(rpcResult.success === true, 'RPC returned success = true');
  assert(rpcResult.status === 'completed', 'RPC returned status = "completed"');
  assert(rpcResult.mutated === true, 'RPC returned mutated = true');
  assert(
    rpcResult.completed_at !== null,
    'RPC returned truthful completed_at timestamp'
  );

  // Verify accounts table
  const accRow = queryJson(
    `SELECT name, industry, status, onboarding_completed_at, onboarding_exempted_at FROM public.accounts WHERE id = '${testAcc2}'`
  )[0];
  assert(
    accRow.name === 'Apollo Healthcare Clinic',
    'Account name updated to Apollo Healthcare Clinic'
  );
  assert(
    accRow.industry === 'hospital_clinic',
    'Account industry updated to hospital_clinic'
  );
  assert(accRow.status === 'active', 'Account status preserved as active');
  assert(
    accRow.onboarding_completed_at !== null,
    'Account has onboarding_completed_at set'
  );
  assert(
    accRow.onboarding_exempted_at === null,
    'Account onboarding_exempted_at remains NULL (truthful)'
  );

  // Verify tenant modules
  const modRow = queryJson(
    `SELECT enabled FROM public.tenant_modules WHERE account_id = '${testAcc2}' AND module_key = 'hospital_clinic'`
  )[0];
  assert(
    modRow && modRow.enabled === true,
    'tenant_modules for hospital_clinic enabled'
  );

  // Verify pipelines and pipeline stages
  const pipeRow = queryJson(
    `SELECT id, name FROM public.pipelines WHERE account_id = '${testAcc2}' LIMIT 1`
  )[0];
  assert(pipeRow && pipeRow.id !== null, 'Sales pipeline created');
  const stageCount = queryJson(
    `SELECT count(*)::int as c FROM public.pipeline_stages WHERE pipeline_id = '${pipeRow.id}'`
  )[0].c;
  assert(stageCount === 3, 'All 3 pipeline stages created in same transaction');

  // Verify knowledge base entries + user preservation
  const kbRows = queryJson(
    `SELECT question_title FROM public.knowledge_base WHERE account_id = '${testAcc2}'`
  );
  const titles = kbRows.map((r) => r.question_title);
  assert(
    titles.includes('Is wheelchair access available?'),
    'Pre-existing user custom FAQ was PRESERVED'
  );
  assert(
    titles.includes('OPD Consultation Fee'),
    'New custom pricing FAQ seeded'
  );
  assert(titles.includes('Clinic Hours'), 'New clinic hours FAQ seeded');

  // Verify broadcasts + user preservation
  const broadcastRows = queryJson(
    `SELECT name FROM public.broadcasts WHERE account_id = '${testAcc2}'`
  );
  const bNames = broadcastRows.map((r) => r.name);
  assert(
    bNames.includes('Tenant Draft Summer Promo'),
    'Pre-existing user draft broadcast was PRESERVED'
  );
  assert(
    bNames.includes('Seasonal Health Checkup'),
    'New campaign template seeded'
  );

  // Verify automations and steps
  const autoRows = queryJson(
    `SELECT id, name, metadata FROM public.automations WHERE account_id = '${testAcc2}'`
  );
  assert(autoRows.length >= 1, 'Automations created in same transaction');
  const seededAuto = autoRows.find(
    (a) => a.metadata?.helpa_seeded_workflow === true
  );
  assert(
    seededAuto !== undefined,
    'Automation seeded with helpa_seeded_workflow provenance tag'
  );
  const stepCount = queryJson(
    `SELECT count(*)::int as c FROM public.automation_steps WHERE automation_id = '${seededAuto.id}'`
  )[0].c;
  assert(stepCount === 1, 'Automation step created in same transaction');

  // 4. Lost Response / Idempotent Retry Safety
  console.log('\n--- 4. Testing Lost-Response / Idempotent Retry ---');
  const retryResult = queryJson(rpcCallSql)[0].result;
  assert(retryResult.success === true, 'Retry returned success = true');
  assert(
    retryResult.status === 'already_completed',
    'Retry returned status = "already_completed"'
  );
  assert(
    retryResult.mutated === false,
    'Retry returned mutated = false (no mutations replayed)'
  );
  assert(
    retryResult.industry === 'hospital_clinic',
    'Retry returned actual stored workspace industry'
  );
  assert(
    retryResult.completed_at === accRow.onboarding_completed_at,
    'Retry returned actual stored completed_at timestamp'
  );

  // Verify record counts unchanged
  const kbCountAfterRetry = queryJson(
    `SELECT count(*)::int as c FROM public.knowledge_base WHERE account_id = '${testAcc2}'`
  )[0].c;
  assert(
    kbCountAfterRetry === kbRows.length,
    'No duplicate knowledge base entries created on retry'
  );
  const autoCountAfterRetry = queryJson(
    `SELECT count(*)::int as c FROM public.automations WHERE account_id = '${testAcc2}'`
  )[0].c;
  assert(
    autoCountAfterRetry === autoRows.length,
    'No duplicate automations created on retry'
  );

  // 5. Concurrent Submissions Under Row Lock
  console.log('\n--- 5. Testing Concurrent Submissions Safety on Repo DB ---');
  const ws3 = createTestWorkspace('concurrent');
  const testAcc3 = ws3.accountId;
  const concSql = `
    SELECT public.complete_workspace_onboarding(
      '${testAcc3}',
      '${ws3.userId}',
      'salon',
      'Concurrent Salon',
      NULL,
      'Prompt',
      'Welcome'
    );
  `;

  const [res1, res2] = await Promise.all([
    runAsyncPsql(concSql),
    runAsyncPsql(concSql),
  ]);

  const p1 = JSON.parse(res1.stdout);
  const p2 = JSON.parse(res2.stdout);

  const mutatedCount = [p1, p2].filter(
    (r) => r.status === 'completed' && r.mutated === true
  ).length;
  const unmutatedCount = [p1, p2].filter(
    (r) => r.status === 'already_completed' && r.mutated === false
  ).length;
  assert(
    mutatedCount === 1,
    'Concurrent execution: Exactly 1 transaction acquired lock and mutated'
  );
  assert(
    unmutatedCount === 1,
    'Concurrent execution: The other transaction returned already_completed with mutated=false'
  );

  // 6. Explicit Reconfiguration Contract (p_reconfigure = true)
  console.log('\n--- 6. Testing Explicit Reconfiguration Contract ---');

  // 6A. Reject reconfigure for unresolved accounts under transaction lock
  const wsUnresolved = createTestWorkspace('unresolved_reconfig');
  const unresolvedReconfigRes = execSql(`
    SELECT public.complete_workspace_onboarding(
      '${wsUnresolved.accountId}'::uuid,
      '${wsUnresolved.userId}'::uuid,
      'salon'::text,
      'Unresolved Workspace'::text,
      NULL,
      'Prompt'::text,
      'Welcome'::text,
      ARRAY['salon']::text[],
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      true
    );
  `);
  assert(
    unresolvedReconfigRes.success === false,
    'Reconfigure on unresolved account is rejected by transaction lock check'
  );
  assert(
    unresolvedReconfigRes.stderr.includes(
      'Cannot reconfigure an unresolved account'
    ),
    'Rejection error message explicitly identifies unresolved account requirement'
  );

  // 6B. Reconfigure on completed account: updates industry, preserves original completion timestamp
  const originalCompletedAt = accRow.onboarding_completed_at;
  const reconfigureSql = `
    SELECT public.complete_workspace_onboarding(
      '${testAcc2}'::uuid,
      '${ws2.userId}'::uuid,
      'salon'::text,
      'Apollo Healthcare & Wellness Salon'::text,
      NULL,
      'You are Apollo Healthcare salon assistant'::text,
      'Welcome to Apollo Salon'::text,
      ARRAY['hospital_clinic', 'real_estate', 'salon']::text[],
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      true
    ) as result;
  `;
  const reconfigResult = queryJson(reconfigureSql)[0].result;
  assert(
    reconfigResult.success === true,
    'Reconfigure returned success = true'
  );
  assert(
    reconfigResult.status === 'reconfigured',
    'Reconfigure returned status = "reconfigured"'
  );
  assert(
    reconfigResult.mutated === true,
    'Reconfigure returned mutated = true'
  );
  assert(
    reconfigResult.completed_at === originalCompletedAt,
    'Reconfigure preserved original completed_at timestamp'
  );
  const updatedAcc = queryJson(
    `SELECT industry, onboarding_completed_at FROM public.accounts WHERE id = '${testAcc2}'`
  )[0];
  assert(
    updatedAcc.industry === 'salon',
    'Reconfigure updated workspace industry to salon'
  );
  assert(
    updatedAcc.onboarding_completed_at === originalCompletedAt,
    'Account table preserved original onboarding_completed_at'
  );

  // 6C. Reconfigure on exempted legacy account: preserves NULL completed_at and original exemption
  const wsExempt = createTestWorkspace('exempt_reconfig');
  execSql(`
    UPDATE public.accounts
    SET onboarding_exempted_at = now() - interval '1 day',
        onboarding_exemption_reason = 'legacy_account_pre_contract'
    WHERE id = '${wsExempt.accountId}';
  `);
  const exemptBefore = queryJson(
    `SELECT onboarding_completed_at, onboarding_exempted_at, onboarding_exemption_reason FROM public.accounts WHERE id = '${wsExempt.accountId}'`
  )[0];
  const reconfigExemptSql = `
    SELECT public.complete_workspace_onboarding(
      '${wsExempt.accountId}'::uuid,
      '${wsExempt.userId}'::uuid,
      'salon'::text,
      'Exempt Reconfigured Salon'::text,
      NULL,
      'Prompt'::text,
      'Welcome'::text,
      ARRAY['salon']::text[],
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      true
    ) as result;
  `;
  const reconfigExemptResult = queryJson(reconfigExemptSql)[0].result;
  assert(
    reconfigExemptResult.success === true,
    'Reconfigure on exempted account succeeded'
  );
  assert(
    reconfigExemptResult.status === 'reconfigured',
    'Exempted account reconfigure returned status = "reconfigured"'
  );
  const exemptAfter = queryJson(
    `SELECT industry, onboarding_completed_at, onboarding_exempted_at, onboarding_exemption_reason FROM public.accounts WHERE id = '${wsExempt.accountId}'`
  )[0];
  assert(
    exemptAfter.industry === 'salon',
    'Exempt account industry updated to salon'
  );
  assert(
    exemptAfter.onboarding_completed_at === null,
    'Exempt account onboarding_completed_at strictly preserved as NULL'
  );
  assert(
    exemptAfter.onboarding_exempted_at === exemptBefore.onboarding_exempted_at,
    'Exempt account onboarding_exempted_at strictly preserved'
  );
  assert(
    exemptAfter.onboarding_exemption_reason ===
      exemptBefore.onboarding_exemption_reason,
    'Exempt account exemption_reason strictly preserved'
  );

  // 7. Testing Branched Workflow Templates with Hierarchical Steps
  console.log('\n--- 7. Testing Branched Workflow Tree Semantics ---');
  const ws4 = createTestWorkspace('branched_wf');
  const testAcc4 = ws4.accountId;
  const rootStepId = randomUUID();
  const yesStepId = randomUUID();
  const noStepId = randomUUID();

  const branchedPayload = JSON.stringify([
    {
      name: 'Clinic Triage Workflow',
      seed_key: 'clinic_triage',
      trigger_type: 'keyword',
      trigger_config: { keyword: 'triage' },
      is_active: true,
      steps: [
        {
          id: rootStepId,
          parent_step_id: null,
          branch: null,
          step_type: 'condition',
          step_config: { condition_type: 'time_window' },
          position: 0,
        },
        {
          id: yesStepId,
          parent_step_id: rootStepId,
          branch: 'yes',
          step_type: 'send_message',
          step_config: { text: 'Open now' },
          position: 0,
        },
        {
          id: noStepId,
          parent_step_id: rootStepId,
          branch: 'no',
          step_type: 'send_message',
          step_config: { text: 'Closed now' },
          position: 1,
        },
      ],
    },
  ]);

  const branchedWfSql = `
    SELECT public.complete_workspace_onboarding(
      '${testAcc4}'::uuid,
      '${ws4.userId}'::uuid,
      'hospital_clinic'::text,
      'Branched Clinic'::text,
      NULL,
      'Prompt'::text,
      'Welcome'::text,
      ARRAY['hospital_clinic']::text[],
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '${branchedPayload.replace(/'/g, "''")}'::jsonb
    ) as result;
  `;
  const branchedResult = queryJson(branchedWfSql)[0].result;
  assert(
    branchedResult.success === true,
    'Branched workflow onboarding succeeded'
  );

  const stepsInDb = queryJson(`
    SELECT id, parent_step_id, branch, step_type, position
    FROM public.automation_steps
    WHERE id IN ('${rootStepId}', '${yesStepId}', '${noStepId}')
    ORDER BY position;
  `);
  assert(stepsInDb.length === 3, 'All 3 hierarchical steps stored in DB');
  const rootRowDb = stepsInDb.find((s) => s.id === rootStepId);
  const yesRowDb = stepsInDb.find((s) => s.id === yesStepId);
  const noRowDb = stepsInDb.find((s) => s.id === noStepId);

  assert(
    rootRowDb && rootRowDb.parent_step_id === null && rootRowDb.branch === null,
    'Root condition step has parent_step_id = NULL and branch = NULL'
  );
  assert(
    yesRowDb &&
      yesRowDb.parent_step_id === rootStepId &&
      yesRowDb.branch === 'yes',
    'Yes child step references root parent_step_id and branch = "yes"'
  );
  assert(
    noRowDb && noRowDb.parent_step_id === rootStepId && noRowDb.branch === 'no',
    'No child step references root parent_step_id and branch = "no"'
  );

  // 8. Testing Operational and Billing Status Preservation
  console.log('\n--- 8. Testing Operational & Billing Status Preservation ---');
  const ws5 = createTestWorkspace('billing_status');
  const testAcc5 = ws5.accountId;
  // Set non-active billing status e.g. trial or past_due
  execSql(
    `UPDATE public.accounts SET status = 'trial' WHERE id = '${testAcc5}';`
  );
  const beforeStatus = queryJson(
    `SELECT status FROM public.accounts WHERE id = '${testAcc5}'`
  )[0].status;
  assert(beforeStatus === 'trial', 'Pre-onboarding status set to trial');

  const onboardWs5Sql = `
    SELECT public.complete_workspace_onboarding(
      '${testAcc5}'::uuid,
      '${ws5.userId}'::uuid,
      'gym'::text,
      'Fitness Center'::text
    ) as result;
  `;
  const ws5Result = queryJson(onboardWs5Sql)[0].result;
  assert(ws5Result.success === true, 'Onboarding for trial account succeeded');
  const afterStatus = queryJson(
    `SELECT status FROM public.accounts WHERE id = '${testAcc5}'`
  )[0].status;
  assert(
    afterStatus === 'trial',
    'Account status preserved as trial (never overwritten to active)'
  );

  console.log(
    '\n================================================================'
  );
  console.log(
    `REPO DATABASE VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`
  );
  console.log(
    '================================================================\n'
  );

  if (failed > 0) process.exit(1);
}

verifyRepoDb().catch((err) => {
  console.error('Fatal error during repo DB verification:', err);
  process.exit(1);
});
