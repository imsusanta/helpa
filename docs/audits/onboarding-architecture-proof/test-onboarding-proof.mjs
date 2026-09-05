import { execFileSync, spawn } from 'node:child_process';

const DB_HOST = '127.0.0.1';
const DB_NAME = 'helpa_onboarding_proof_db';

function execSql(sql) {
  try {
    const stdout = execFileSync('psql', ['-h', DB_HOST, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-c', sql], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, stdout: stdout.trim() };
  } catch (err) {
    return {
      success: false,
      code: err.status,
      stderr: (err.stderr || err.message || '').toString()
    };
  }
}

function queryJson(sql) {
  const wrappedSql = `WITH t AS (${sql.trim().replace(/;+$/, '')}) SELECT json_agg(t) FROM t;`;
  try {
    const stdout = execFileSync('psql', ['-h', DB_HOST, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', wrappedSql], {
      encoding: 'utf8'
    });
    const trimmed = stdout.trim();
    if (!trimmed || trimmed === '') return [];
    return JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Query failed: ${err.stderr || err.message}\nSQL: ${sql}`);
  }
}

function runAsyncPsql(sql) {
  return new Promise((resolve) => {
    const child = spawn('psql', ['-h', DB_HOST, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function runProof() {
  console.log('====================================================');
  console.log('RUNNING ONBOARDING ARCHITECTURE PROOF (LOCAL PG 16)');
  console.log('====================================================\n');

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

  // ------------------------------------------------------------------------
  // TEST 1: COHORT ISOLATION & MIGRATION RERUN SAFETY
  // ------------------------------------------------------------------------
  console.log('--- 1. Testing Cohorts & Migration Rerun Safety ---');

  // 1a. Check legacy accounts Alpha & Beta (created before migration)
  const legacyRows = queryJson(`
    SELECT id, name, onboarding_completed_at, onboarding_exempted_at, onboarding_exemption_reason 
    FROM public.accounts 
    WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
    ORDER BY name
  `);
  assert(legacyRows.length === 2, 'Found 2 legacy accounts');
  assert(legacyRows[0].onboarding_exempted_at !== null, 'Legacy Alpha has onboarding_exempted_at');
  assert(legacyRows[0].onboarding_completed_at === null, 'Legacy Alpha onboarding_completed_at is truthfully NULL');
  assert(legacyRows[0].onboarding_exemption_reason === 'legacy_account_pre_contract', 'Legacy Alpha exemption reason is legacy_account_pre_contract');
  const alphaExemptTime = legacyRows[0].onboarding_exempted_at;

  // 1b. Create new account Gamma (created AFTER migration cutoff)
  const gammaRes = queryJson(`
    INSERT INTO public.accounts (name) VALUES ('New Account Gamma') 
    RETURNING id, created_at, onboarding_completed_at, onboarding_exempted_at
  `);
  const gammaId = gammaRes[0].id;
  assert(gammaRes[0].onboarding_exempted_at === null, 'New Account Gamma onboarding_exempted_at = NULL');
  assert(gammaRes[0].onboarding_completed_at === null, 'New Account Gamma onboarding_completed_at = NULL');

  // 1c. Re-run migration logic
  console.log('Re-running migration script with durable cutoff guard...');
  const rerunRes = execSql(`
    DO $$
    DECLARE
      v_cutoff timestamptz;
      v_exempted_at timestamptz := clock_timestamp();
    BEGIN
      -- Persist the exact deployment timestamp on first execution
      INSERT INTO public.migration_onboarding_guard (id, deployment_cutoff)
      VALUES (1, clock_timestamp())
      ON CONFLICT (id) DO NOTHING;

      -- Read persisted cutoff (guaranteed constant across all reruns)
      SELECT deployment_cutoff INTO v_cutoff
      FROM public.migration_onboarding_guard
      WHERE id = 1;

      -- Exempt accounts created on or before the deployment cutoff
      UPDATE public.accounts
      SET
        onboarding_exempted_at = v_exempted_at,
        onboarding_exemption_reason = 'legacy_account_pre_contract'
      WHERE onboarding_completed_at IS NULL
        AND onboarding_exempted_at IS NULL
        AND created_at <= v_cutoff;
    END $$;
  `);
  assert(rerunRes.success, 'Migration rerun executed successfully');

  // 1d. Verify Gamma is STILL unexempted after migration rerun
  const gammaAfterRerun = queryJson(`
    SELECT id, onboarding_completed_at, onboarding_exempted_at FROM public.accounts WHERE id = '${gammaId}'
  `);
  assert(gammaAfterRerun[0].onboarding_exempted_at === null, 'Gamma remains strictly UNEXEMPTED after migration rerun');
  assert(gammaAfterRerun[0].onboarding_completed_at === null, 'Gamma remains uncompleted after migration rerun');

  // 1e. Create Cohort 3 account Theta (created AFTER rerun 1)
  const thetaRes = queryJson(`
    INSERT INTO public.accounts (name) VALUES ('Post-Rerun Account Theta') 
    RETURNING id, created_at, onboarding_completed_at, onboarding_exempted_at
  `);
  const thetaId = thetaRes[0].id;
  assert(thetaRes[0].onboarding_exempted_at === null, 'Cohort 3 Account Theta onboarding_exempted_at = NULL');
  assert(thetaRes[0].onboarding_completed_at === null, 'Cohort 3 Account Theta onboarding_completed_at = NULL');

  // 1f. Re-run migration a second time (rerun 2)
  console.log('Re-running migration script second time (rerun 2)...');
  const rerun2Res = execSql(`
    DO $$
    DECLARE
      v_cutoff timestamptz;
      v_exempted_at timestamptz := clock_timestamp();
    BEGIN
      INSERT INTO public.migration_onboarding_guard (id, deployment_cutoff)
      VALUES (1, clock_timestamp())
      ON CONFLICT (id) DO NOTHING;

      SELECT deployment_cutoff INTO v_cutoff
      FROM public.migration_onboarding_guard
      WHERE id = 1;

      UPDATE public.accounts
      SET
        onboarding_exempted_at = v_exempted_at,
        onboarding_exemption_reason = 'legacy_account_pre_contract'
      WHERE onboarding_completed_at IS NULL
        AND onboarding_exempted_at IS NULL
        AND created_at <= v_cutoff;
    END $$;
  `);
  assert(rerun2Res.success, 'Migration rerun 2 executed successfully');

  // 1g. Verify Cohort 1, 2, and 3 after rerun 2
  const alphaAfterRerun2 = queryJson(`SELECT onboarding_exempted_at FROM public.accounts WHERE id = '11111111-1111-1111-1111-111111111111'`);
  assert(alphaAfterRerun2[0].onboarding_exempted_at === alphaExemptTime, 'Cohort 1 Alpha retains original exemption timestamp across multiple reruns');

  const gammaAfterRerun2 = queryJson(`SELECT onboarding_exempted_at FROM public.accounts WHERE id = '${gammaId}'`);
  assert(gammaAfterRerun2[0].onboarding_exempted_at === null, 'Cohort 2 Gamma remains UNEXEMPTED across multiple reruns');

  const thetaAfterRerun2 = queryJson(`SELECT onboarding_exempted_at FROM public.accounts WHERE id = '${thetaId}'`);
  assert(thetaAfterRerun2[0].onboarding_exempted_at === null, 'Cohort 3 Theta remains UNEXEMPTED across multiple reruns');

  // ------------------------------------------------------------------------
  // TEST 2: PROTECTED-FIELD ENFORCEMENT & POSTGREST SIMULATION
  // ------------------------------------------------------------------------
  console.log('\n--- 2. Testing Field Protection & PostgREST Simulation ---');

  // 2a. Authenticated user updating onboarding_completed_at -> REJECTED
  const authUpdateRes = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
    UPDATE public.accounts SET onboarding_completed_at = now() WHERE id = '${gammaId}';
    COMMIT;
  `);
  assert(
    !authUpdateRes.success && authUpdateRes.stderr.includes('42501'),
    'Direct UPDATE of onboarding_completed_at by authenticated role blocked (42501)'
  );

  // 2b. Anon user updating onboarding_exempted_at -> REJECTED
  const anonUpdateRes = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'anon';
    SET LOCAL "request.jwt.claim.role" = 'anon';
    UPDATE public.accounts SET onboarding_exempted_at = now() WHERE id = '${gammaId}';
    COMMIT;
  `);
  assert(
    !anonUpdateRes.success && anonUpdateRes.stderr.includes('42501'),
    'Direct UPDATE of onboarding_exempted_at by anon role blocked (42501)'
  );

  // 2c. Direct INSERT of onboarding_completed_at by authenticated role -> REJECTED
  const authInsertRes = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
    INSERT INTO public.accounts (name, onboarding_completed_at) VALUES ('Hacker Account', now());
    COMMIT;
  `);
  assert(
    !authInsertRes.success && authInsertRes.stderr.includes('42501'),
    'Direct INSERT with onboarding_completed_at by authenticated role blocked (42501)'
  );

  // 2d. Direct INSERT of onboarding_exempted_at by anon role -> REJECTED
  const anonInsertRes = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'anon';
    SET LOCAL "request.jwt.claim.role" = 'anon';
    INSERT INTO public.accounts (name, onboarding_exempted_at) VALUES ('Anon Injected Account', now());
    COMMIT;
  `);
  assert(
    !anonInsertRes.success && anonInsertRes.stderr.includes('42501'),
    'Direct INSERT with onboarding_exempted_at by anon role blocked (42501)'
  );

  // 2e. Legitimate INSERT without onboarding fields by authenticated role -> SUCCESS
  const legitInsertRes = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
    INSERT INTO public.accounts (name) VALUES ('Normal Signup Account');
    COMMIT;
  `);
  assert(legitInsertRes.success, 'Legitimate signup account creation without onboarding fields succeeds');

  // 2f. Direct RPC invocation of complete_workspace_onboarding by authenticated role -> REJECTED (42501)
  const rpcAuthRes = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
    SELECT public.complete_workspace_onboarding('${gammaId}', 'Hack', 'general', 'Prompt', 'Welcome');
    COMMIT;
  `);
  assert(
    !rpcAuthRes.success && (rpcAuthRes.stderr.includes('42501') || rpcAuthRes.stderr.includes('permission denied')),
    'Direct RPC invocation of complete_workspace_onboarding by authenticated role blocked (permission denied)'
  );

  // 2g. Direct RPC invocation of complete_workspace_onboarding by anon role -> REJECTED (42501)
  const rpcAnonRes = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'anon';
    SET LOCAL "request.jwt.claim.role" = 'anon';
    SELECT public.complete_workspace_onboarding('${gammaId}', 'Hack', 'general', 'Prompt', 'Welcome');
    COMMIT;
  `);
  assert(
    !rpcAnonRes.success && (rpcAnonRes.stderr.includes('42501') || rpcAnonRes.stderr.includes('permission denied')),
    'Direct RPC invocation of complete_workspace_onboarding by anon role blocked (permission denied)'
  );

  // 2h. Missing / unexpected JWT claim with untrusted session -> REJECTED (fail closed)
  const missingClaimRes = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    -- No request.jwt.claim.role set!
    UPDATE public.accounts SET onboarding_completed_at = now() WHERE id = '${gammaId}';
    COMMIT;
  `);
  assert(
    !missingClaimRes.success && missingClaimRes.stderr.includes('42501'),
    'Direct UPDATE with missing JWT claims fails closed (42501)'
  );

  // 2i. Legitimate profile update by authenticated user -> SUCCESS
  const legitUpdateRes = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'authenticated';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
    UPDATE public.accounts SET name = 'Renamed Workspace Gamma' WHERE id = '${gammaId}';
    COMMIT;
  `);
  assert(legitUpdateRes.success, 'Legitimate account name update by authenticated user succeeds');

  // 2j. Authorized backend (service_role) updating completion marker -> SUCCESS
  const serviceRoleRes = execSql(`
    BEGIN;
    SET LOCAL ROLE = 'service_role';
    SET LOCAL "request.jwt.claim.role" = 'service_role';
    UPDATE public.accounts SET onboarding_completed_at = now() WHERE id = '22222222-2222-2222-2222-222222222222';
    COMMIT;
  `);
  assert(serviceRoleRes.success, 'Authorized service_role can update onboarding fields');

  // ------------------------------------------------------------------------
  // TEST 3: ONE TRANSACTION ATOMIC EXECUTION & ROLLBACK
  // ------------------------------------------------------------------------
  console.log('\n--- 3. Testing Single-Transaction RPC & Rollback ---');

  // Create Account Delta (un-onboarded)
  const deltaRes = queryJson(`
    INSERT INTO public.accounts (name) VALUES ('Account Delta') RETURNING id
  `);
  const deltaId = deltaRes[0].id;

  // 3a. Mid-flow failure & atomic rollback
  const failureRes = execSql(`
    SELECT public.complete_workspace_onboarding(
      '${deltaId}', 'Delta Clinic', 'hospital_clinic', 'Prompt text', 'Welcome!', '[]'::jsonb, true
    );
  `);
  assert(
    !failureRes.success && failureRes.stderr.includes('Simulated failure during initialization'),
    'Simulated initialization failure throws exception'
  );

  // Verify ZERO writes occurred on Delta (atomic rollback)
  const deltaAccount = queryJson(`SELECT onboarding_completed_at, industry FROM public.accounts WHERE id = '${deltaId}'`)[0];
  const deltaModules = queryJson(`SELECT count(*)::int as c FROM public.tenant_modules WHERE account_id = '${deltaId}'`)[0].c;
  const deltaPipelines = queryJson(`SELECT count(*)::int as c FROM public.pipelines WHERE account_id = '${deltaId}'`)[0].c;
  const deltaAutomations = queryJson(`SELECT count(*)::int as c FROM public.automations WHERE account_id = '${deltaId}'`)[0].c;

  assert(deltaAccount.onboarding_completed_at === null, 'Atomic Rollback: onboarding_completed_at is still NULL');
  assert(deltaAccount.industry === 'general', 'Atomic Rollback: account industry was rolled back');
  assert(deltaModules === 0, 'Atomic Rollback: 0 tenant modules written');
  assert(deltaPipelines === 0, 'Atomic Rollback: 0 pipelines written');
  assert(deltaAutomations === 0, 'Atomic Rollback: 0 automations written');

  // 3b. Successful completion
  const completeRes = queryJson(`
    SELECT public.complete_workspace_onboarding(
      '${deltaId}', 'Delta Clinic', 'hospital_clinic', 'Prompt text', 'Welcome!', 
      '[{"name": "General OPD", "price": "500", "desc": "Consultation"}]'::jsonb, false
    ) as result
  `);
  const resultObj = completeRes[0].result;
  assert(resultObj.success === true, 'RPC returned success: true');
  assert(resultObj.status === 'completed', 'RPC returned status: "completed"');
  assert(resultObj.mutated === true, 'RPC returned mutated: true');

  // Verify all records written
  const deltaAccountCompleted = queryJson(`SELECT onboarding_completed_at, industry, name FROM public.accounts WHERE id = '${deltaId}'`)[0];
  const deltaKb = queryJson(`SELECT count(*)::int as c FROM public.knowledge_base WHERE account_id = '${deltaId}'`)[0].c;
  const deltaModulesAfter = queryJson(`SELECT count(*)::int as c FROM public.tenant_modules WHERE account_id = '${deltaId}' AND enabled = true`)[0].c;
  assert(deltaAccountCompleted.onboarding_completed_at !== null, 'Delta has valid onboarding_completed_at timestamp');
  assert(deltaAccountCompleted.name === 'Delta Clinic', 'Delta name was updated');
  assert(deltaAccountCompleted.industry === 'hospital_clinic', 'Delta industry was updated');
  assert(deltaKb === 1, 'Custom service was written to knowledge_base');
  assert(deltaModulesAfter === 1, 'Tenant module was enabled');

  // 3c. Lost Response / Idempotent Retry
  const retryRes = queryJson(`
    SELECT public.complete_workspace_onboarding(
      '${deltaId}', 'Delta Clinic', 'hospital_clinic', 'Prompt text', 'Welcome!', 
      '[{"name": "General OPD", "price": "500", "desc": "Consultation"}]'::jsonb, false
    ) as result
  `);
  const retryObj = retryRes[0].result;
  assert(retryObj.success === true, 'Retry returned success: true');
  assert(retryObj.status === 'already_completed', 'Retry returned status: "already_completed"');
  assert(retryObj.mutated === false, 'Retry returned mutated: false');

  // Verify NO duplicate records created
  const deltaKbAfterRetry = queryJson(`SELECT count(*)::int as c FROM public.knowledge_base WHERE account_id = '${deltaId}'`)[0].c;
  const deltaPipesAfterRetry = queryJson(`SELECT count(*)::int as c FROM public.pipelines WHERE account_id = '${deltaId}'`)[0].c;
  assert(deltaKbAfterRetry === 1, 'No duplicate knowledge base entries created on retry');
  assert(deltaPipesAfterRetry === 1, 'No duplicate pipelines created on retry');

  // ------------------------------------------------------------------------
  // TEST 4: CONCURRENT SUBMISSION SAFETY (TWO CLIENTS)
  // ------------------------------------------------------------------------
  console.log('\n--- 4. Testing Concurrent Submissions Safety ---');

  // Create Account Epsilon
  const epsilonRes = queryJson(`
    INSERT INTO public.accounts (name) VALUES ('Account Epsilon') RETURNING id
  `);
  const epsilonId = epsilonRes[0].id;

  // Fire both simultaneously via separate psql processes
  const sqlEpsilon = `SELECT public.complete_workspace_onboarding('${epsilonId}', 'Epsilon', 'salon', 'Prompt', 'Welcome', '[]'::jsonb, false);`;
  const [c1, c2] = await Promise.all([
    runAsyncPsql(sqlEpsilon),
    runAsyncPsql(sqlEpsilon)
  ]);

  const r1 = JSON.parse(c1.stdout);
  const r2 = JSON.parse(c2.stdout);

  const completedCount = [r1, r2].filter(r => r.status === 'completed' && r.mutated === true).length;
  const alreadyCompletedCount = [r1, r2].filter(r => r.status === 'already_completed' && r.mutated === false).length;

  assert(completedCount === 1, 'Exactly ONE concurrent submission executed the initialization mutations');
  assert(alreadyCompletedCount === 1, 'The other concurrent submission safely returned already_completed with mutated=false');

  // ------------------------------------------------------------------------
  // TEST 5: PRESERVATION OF USER-CREATED DATA
  // ------------------------------------------------------------------------
  console.log('\n--- 5. Testing Preservation of User Content ---');

  // Create Account Zeta
  const zetaRes = queryJson(`
    INSERT INTO public.accounts (name) VALUES ('Account Zeta') RETURNING id
  `);
  const zetaId = zetaRes[0].id;

  // User creates a draft broadcast BEFORE onboarding
  execSql(`INSERT INTO public.broadcasts (account_id, name, status) VALUES ('${zetaId}', 'User Custom Summer Promo', 'draft');`);

  // User creates a custom FAQ entry BEFORE onboarding
  execSql(`
    INSERT INTO public.knowledge_base (account_id, category, question_title, answer_content)
    VALUES ('${zetaId}', 'faq', 'Is parking available at the venue?', 'Yes, free valet parking is available.');
  `);

  // Run onboarding
  execSql(`
    SELECT public.complete_workspace_onboarding('${zetaId}', 'Zeta Practice', 'hospital_clinic', 'Prompt', 'Welcome', '[]'::jsonb, false);
  `);

  // Check user draft broadcast
  const userBroadcast = queryJson(`
    SELECT name, status FROM public.broadcasts WHERE account_id = '${zetaId}' AND name = 'User Custom Summer Promo'
  `);
  assert(userBroadcast.length === 1, 'User-created draft broadcast was 100% PRESERVED');
  assert(userBroadcast[0].status === 'draft', 'User-created draft broadcast status intact');

  // Check user custom FAQ
  const userFaq = queryJson(`
    SELECT question_title, answer_content FROM public.knowledge_base WHERE account_id = '${zetaId}' AND question_title = 'Is parking available at the venue?'
  `);
  assert(userFaq.length === 1, 'User-created custom FAQ was 100% PRESERVED');
  assert(userFaq[0].answer_content === 'Yes, free valet parking is available.', 'User FAQ content intact');

  console.log('\n====================================================');
  console.log(`PROOF EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProof().catch((err) => {
  console.error('Unhandled proof error:', err);
  process.exit(1);
});
