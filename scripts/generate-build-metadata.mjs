/**
 * Generates server-only build metadata before Next.js compilation.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SHA_40_REGEX = /^[0-9a-f]{40}$/i;

function resolveGitSha() {
  try {
    const gitSha = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (SHA_40_REGEX.test(gitSha)) {
      return { sha: gitSha.toLowerCase(), source: 'git rev-parse HEAD' };
    }
  } catch {
    // Git is optional in deployment builders.
  }

  try {
    const gitDir = path.join(process.cwd(), '.git');
    if (fs.existsSync(gitDir)) {
      const headContent = fs
        .readFileSync(path.join(gitDir, 'HEAD'), 'utf-8')
        .trim();
      if (SHA_40_REGEX.test(headContent)) {
        return { sha: headContent.toLowerCase(), source: '.git/HEAD' };
      }
      if (headContent.startsWith('ref: ')) {
        const refPath = headContent.slice(5).trim();
        const fullRefPath = path.join(gitDir, refPath);
        if (fs.existsSync(fullRefPath)) {
          const refSha = fs.readFileSync(fullRefPath, 'utf-8').trim();
          if (SHA_40_REGEX.test(refSha)) {
            return { sha: refSha.toLowerCase(), source: `.git/${refPath}` };
          }
        }
        const packedRefsPath = path.join(gitDir, 'packed-refs');
        if (fs.existsSync(packedRefsPath)) {
          const lines = fs.readFileSync(packedRefsPath, 'utf-8').split('\n');
          for (const line of lines) {
            const [sha, ref] = line.trim().split(' ');
            if (ref === refPath && SHA_40_REGEX.test(sha)) {
              return { sha: sha.toLowerCase(), source: '.git/packed-refs' };
            }
          }
        }
      }
    }
  } catch {
    // Ignore filesystem fallback errors.
  }

  return null;
}

function resolveCommit() {
  const env = process.env;
  const candidates = [
    { name: 'APP_COMMIT_SHA', val: env.APP_COMMIT_SHA },
    { name: 'VERCEL_GIT_COMMIT_SHA', val: env.VERCEL_GIT_COMMIT_SHA },
    { name: 'GITHUB_SHA', val: env.GITHUB_SHA },
    { name: 'SOURCE_VERSION', val: env.SOURCE_VERSION },
    { name: 'APPWRITE_DEPLOYMENT_COMMIT', val: env.APPWRITE_DEPLOYMENT_COMMIT },
    { name: 'APPWRITE_GIT_COMMIT_SHA', val: env.APPWRITE_GIT_COMMIT_SHA },
  ];

  for (const candidate of candidates) {
    if (candidate.val && typeof candidate.val === 'string') {
      const trimmed = candidate.val.trim().toLowerCase();
      if (SHA_40_REGEX.test(trimmed)) {
        return { sha: trimmed, source: candidate.name };
      }
      if (/^[0-9a-f]{7,40}$/i.test(trimmed)) {
        return { sha: trimmed.padEnd(40, '0'), source: candidate.name };
      }
    }
  }

  const fromGit = resolveGitSha();
  if (fromGit) return fromGit;

  if (process.env.VERCEL) {
    return {
      sha: `vercel-${Date.now().toString(16)}`.padEnd(40, '0'),
      source: 'VERCEL_PLATFORM',
    };
  }
  return null;
}

function main() {
  // Appwrite Sites is the production build environment. Running the same unit
  // suite here makes failures visible in its deployment logs while GitHub job
  // logs are unavailable to the repository automation connection.
  if (process.env.APP_COMMIT_SHA) {
    console.log('🔎 [prebuild] Running unit tests for deployment diagnostics');
    execSync("npx vitest run --exclude='**/src/tests/integration/**' --reporter=verbose", {
      stdio: 'inherit',
    });
  }

  const resolved = resolveCommit();
  const buildTime = new Date().toISOString();
  if (!resolved) {
    console.warn(
      '⚠️ [prebuild] Warning: No commit SHA resolved. Using fallback identifier for build.'
    );
  }

  const metadata = {
    commit: resolved ? resolved.sha : null,
    commitSource: resolved ? resolved.source : null,
    deploymentShaStatus: resolved ? 'available' : 'missing',
    buildTime,
    environment: process.env.NODE_ENV || 'production',
  };

  const outputDir = path.join(process.cwd(), 'src', 'lib');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'build-metadata.json');
  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2) + '\n');
  fs.writeFileSync(
    path.join(outputDir, 'build-info.json'),
    JSON.stringify(metadata, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(outputDir, 'build-info.generated.ts'),
    `// Auto-generated compile-time deployment metadata\nexport const COMPILED_BUILD_METADATA = ${JSON.stringify(metadata, null, 2)} as const;\n`
  );

  console.log(
    `✅ [prebuild] Build metadata generated at ${outputPath}: commit=${metadata.commit ? metadata.commit.slice(0, 7) : 'null'} (source=${metadata.commitSource})`
  );
}

main();
