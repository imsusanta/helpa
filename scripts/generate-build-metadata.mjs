/**
 * scripts/generate-build-metadata.mjs
 *
 * Runs during `prebuild` to extract and validate deployment commit metadata,
 * baking it into a server-only JSON file before `next build` bundles the application.
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
    // Git not available or not a git repository
  }

  // Fallback: direct filesystem read of .git in case git CLI is absent in builder
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
        // Also check packed-refs
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
    // Ignore fallback errors
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
    }
  }

  // Fallback to git CLI
  const fromGit = resolveGitSha();
  if (fromGit) {
    return fromGit;
  }

  return null;
}

function main() {
  const resolved = resolveCommit();
  const buildTime = new Date().toISOString();
  const isProd =
    process.env.NODE_ENV === 'production' || process.env.CI === 'true';

  if (!resolved) {
    if (isProd && process.env.ALLOW_UNKNOWN_COMMIT !== 'true') {
      console.error(
        '❌ [prebuild] ERROR: Could not resolve a valid 40-character Git commit SHA in production environment.'
      );
      console.error(
        'Set APP_COMMIT_SHA, GITHUB_SHA, VERCEL_GIT_COMMIT_SHA, SOURCE_VERSION, or ensure .git is present.'
      );
      process.exit(1);
    }

    console.warn(
      '⚠️ [prebuild] Warning: No commit SHA resolved. Setting null commit for non-production build.'
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
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'build-metadata.json');
  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2) + '\n');

  const tsContent = `// Auto-generated during prebuild. Do not edit manually.
export const BUILD_METADATA = {
  commit: ${metadata.commit ? JSON.stringify(metadata.commit) : 'null'},
  commitSource: ${metadata.commitSource ? JSON.stringify(metadata.commitSource) : 'null'},
  deploymentShaStatus: ${JSON.stringify(metadata.deploymentShaStatus)},
  buildTime: ${JSON.stringify(metadata.buildTime)},
  environment: ${JSON.stringify(metadata.environment)},
} as const;
`;
  const tsPath = path.join(outputDir, 'build-info.ts');
  fs.writeFileSync(tsPath, tsContent);

  console.log(
    `✅ [prebuild] Build metadata generated at ${outputPath} and ${tsPath}: commit=${metadata.commit ? metadata.commit.slice(0, 7) : 'null'} (source=${metadata.commitSource})`
  );
}

main();
