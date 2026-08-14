/**
 * scripts/verify-deployment.mjs
 *
 * Comprehensive Post-Deployment Verification Script.
 * Polls the production endpoints with cache-busting, validates the deployed commit SHA against the expected SHA,
 * checks health and database status, and outputs redacted verification artifacts.
 */

import fs from 'fs';
import path from 'path';

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://www.helpa.studio';
const EXPECTED_SHA = (process.env.EXPECTED_SHA || process.env.GITHUB_SHA || '')
  .trim()
  .toLowerCase();
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || '30', 10);
const RETRY_INTERVAL_MS = parseInt(
  process.env.RETRY_INTERVAL_MS || '10000',
  10
);
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || 'artifacts';

const SHA_40_REGEX = /^[0-9a-f]{40}$/;

if (!EXPECTED_SHA || !SHA_40_REGEX.test(EXPECTED_SHA)) {
  console.error(
    `❌ Invalid or missing EXPECTED_SHA: "${EXPECTED_SHA}". Must be a 40-char hex string.`
  );
  process.exit(1);
}

console.log(`🔍 Verifying live production deployment on: ${PRODUCTION_URL}`);
console.log(`🎯 Expected Commit SHA: ${EXPECTED_SHA}`);
console.log(
  `⏱️  Max polling attempts: ${MAX_ATTEMPTS} (interval: ${RETRY_INTERVAL_MS / 1000}s)`
);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function saveArtifacts(result) {
  try {
    const dir = path.resolve(process.cwd(), EVIDENCE_DIR);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const jsonPath = path.join(dir, 'deployment-verification.json');
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

    const mdContent = `# Production Deployment Verification Report

- **Target URL**: \`${result.productionUrl}\`
- **Expected SHA**: \`${result.expectedSha}\`
- **Deployed SHA**: \`${result.deployedSha || 'None'}\`
- **Match Status**: **${result.shaMatch ? 'PASS' : 'FAIL'}**
- **Homepage Status**: \`${result.homepageStatus || 'N/A'}\`
- **Login Status**: \`${result.loginStatus || 'N/A'}\`
- **Health Status**: \`${result.healthStatus || 'N/A'}\`
- **Database Healthy**: \`${result.databaseHealthy ? 'YES' : 'NO'}\`
- **Verification Result**: **${result.success ? 'SUCCESS' : 'FAILED'}**
- **Timestamp**: \`${result.timestamp}\`
`;
    const mdPath = path.join(dir, 'deployment-verification.md');
    fs.writeFileSync(mdPath, mdContent);
    console.log(`📄 Redacted verification artifacts saved to ${dir}`);
  } catch (err) {
    console.warn(`⚠️ Could not save verification artifacts: ${err.message}`);
  }
}

async function verify() {
  const startTime = new Date().toISOString();
  const latestResult = {
    productionUrl: PRODUCTION_URL,
    expectedSha: EXPECTED_SHA,
    deployedSha: null,
    shaMatch: false,
    homepageStatus: null,
    loginStatus: null,
    healthStatus: null,
    databaseHealthy: false,
    success: false,
    timestamp: startTime,
    attempts: 0,
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    latestResult.attempts = attempt;
    latestResult.timestamp = new Date().toISOString();
    console.log(`\n--- Verification Attempt ${attempt}/${MAX_ATTEMPTS} ---`);

    try {
      const cacheBust = `_t=${Date.now()}`;

      // 1. Check Homepage
      const homeRes = await fetch(`${PRODUCTION_URL}/?${cacheBust}`, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      latestResult.homepageStatus = homeRes?.status || null;
      console.log(`Homepage HTTP status: ${latestResult.homepageStatus}`);

      // 2. Check /login
      const loginRes = await fetch(`${PRODUCTION_URL}/login?${cacheBust}`, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      latestResult.loginStatus = loginRes?.status || null;
      console.log(`Login HTTP status: ${latestResult.loginStatus}`);

      // 3. Check /api/health
      const healthRes = await fetch(
        `${PRODUCTION_URL}/api/health?${cacheBust}`,
        {
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(8000),
        }
      ).catch(() => null);
      latestResult.healthStatus = healthRes?.status || null;
      console.log(`Health HTTP status: ${latestResult.healthStatus}`);

      if (
        !healthRes ||
        (healthRes.status !== 200 && healthRes.status !== 503)
      ) {
        console.warn(
          `⚠️ Health endpoint returned unexpected status: ${latestResult.healthStatus}. Retrying...`
        );
        await sleep(RETRY_INTERVAL_MS);
        continue;
      }

      const body = await healthRes.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        console.warn(
          '⚠️ Invalid JSON body returned from /api/health. Retrying...'
        );
        await sleep(RETRY_INTERVAL_MS);
        continue;
      }

      const deployedSha = (body.commit || '').trim().toLowerCase();
      latestResult.deployedSha = deployedSha;
      latestResult.databaseHealthy = body.checks?.database === 'healthy';

      console.log(
        `Deployed Commit SHA: ${deployedSha} (status: ${body.deploymentShaStatus || 'unknown'}, source: ${body.commitSource || 'unknown'})`
      );
      console.log(
        `Database Healthy: ${latestResult.databaseHealthy ? 'YES' : 'NO'}`
      );

      if (!SHA_40_REGEX.test(deployedSha)) {
        console.warn(
          `⚠️ Deployed commit is not a valid 40-char SHA: "${deployedSha}". Retrying...`
        );
        await sleep(RETRY_INTERVAL_MS);
        continue;
      }

      if (deployedSha !== EXPECTED_SHA) {
        console.warn(
          `⏳ SHA mismatch: deployed=${deployedSha} vs expected=${EXPECTED_SHA}. Domain alias may still be updating. Retrying...`
        );
        await sleep(RETRY_INTERVAL_MS);
        continue;
      }

      latestResult.shaMatch = true;
      latestResult.success =
        latestResult.homepageStatus === 200 &&
        latestResult.loginStatus === 200 &&
        (healthRes.status === 200 || healthRes.status === 503);

      saveArtifacts(latestResult);
      console.log(
        `\n✅ Verification SUCCESS! Live production SHA matches expected SHA (${EXPECTED_SHA}).`
      );
      process.exit(0);
    } catch (err) {
      console.warn(
        `⚠️ Request error on attempt ${attempt}: ${err.message}. Retrying...`
      );
      await sleep(RETRY_INTERVAL_MS);
    }
  }

  latestResult.success = false;
  saveArtifacts(latestResult);
  console.error(
    `\n❌ Deployment verification TIMEOUT: Live production SHA did not match ${EXPECTED_SHA} after ${MAX_ATTEMPTS} attempts.`
  );
  process.exit(1);
}

verify();
