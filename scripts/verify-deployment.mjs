/**
 * scripts/verify-deployment.mjs
 *
 * Post-Deployment Verification Script.
 * Polls the production /api/health endpoint, parses the returned commit SHA,
 * and validates that the live deployed SHA matches the expected commit SHA exactly.
 */

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://www.helpa.studio';
const EXPECTED_SHA = (process.env.EXPECTED_SHA || process.env.GITHUB_SHA || '')
  .trim()
  .toLowerCase();
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || '30', 10);
const RETRY_INTERVAL_MS = parseInt(
  process.env.RETRY_INTERVAL_MS || '10000',
  10
);

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

async function verify() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`\n--- Attempt ${attempt}/${MAX_ATTEMPTS} ---`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${PRODUCTION_URL}/api/health`, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const status = res.status;
      console.log(`HTTP Status: ${status}`);

      if (status !== 200 && status !== 503) {
        console.warn(`⚠️ Unexpected HTTP status: ${status}. Retrying...`);
        await sleep(RETRY_INTERVAL_MS);
        continue;
      }

      const body = await res.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        console.warn(
          '⚠️ Invalid JSON body returned from /api/health. Retrying...'
        );
        await sleep(RETRY_INTERVAL_MS);
        continue;
      }

      const deployedSha = (body.commit || '').trim().toLowerCase();
      const shaStatus = body.deploymentShaStatus || 'unknown';
      console.log(`Deployed Commit SHA: ${deployedSha} (status: ${shaStatus})`);

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

  console.error(
    `\n❌ Deployment verification TIMEOUT: Live production SHA did not match ${EXPECTED_SHA} after ${MAX_ATTEMPTS} attempts.`
  );
  process.exit(1);
}

verify();
