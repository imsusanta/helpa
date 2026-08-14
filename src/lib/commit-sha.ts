import fs from 'fs';
import path from 'path';

export interface CommitResolution {
  commit: string | null;
  commitSource: string | null;
  deploymentShaStatus: 'verified' | 'missing' | 'invalid' | 'development';
  buildTime: string | null;
  isValid: boolean;
}

const SHA_40_REGEX = /^[0-9a-f]{40}$/i;

interface BuildInfo {
  commit?: string;
  buildTime?: string;
  source?: string;
}

function getBuildInfo(): BuildInfo | null {
  try {
    const buildInfoPath = path.join(
      process.cwd(),
      'src',
      'lib',
      'build-info.json'
    );
    if (fs.existsSync(buildInfoPath)) {
      const content = fs.readFileSync(buildInfoPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Ignore build info read errors
  }
  return null;
}

/**
 * Resolves the active deployment commit SHA strictly in order of precedence:
 * 1. APP_COMMIT_SHA (Explicit server-only canonical deployment variable)
 * 2. VERCEL_GIT_COMMIT_SHA (Vercel deployment platform)
 * 3. GITHUB_SHA (GitHub Actions CI/CD)
 * 4. SOURCE_VERSION (Appwrite / generic container deployment engine)
 * 5. NEXT_PUBLIC_COMMIT_SHA (Build-time inlined fallback)
 * 6. src/lib/build-info.json (Generated during next build)
 */
export function resolveCommitSha(
  env: NodeJS.ProcessEnv = process.env
): CommitResolution {
  const isProd = env.NODE_ENV === 'production';
  const isTest = env.NODE_ENV === 'test';

  // If in development or test with no production vars, return dev identity
  if (!isProd) {
    const hasExplicitProdVar = Boolean(
      env.APP_COMMIT_SHA ||
      env.VERCEL_GIT_COMMIT_SHA ||
      env.GITHUB_SHA ||
      env.SOURCE_VERSION
    );

    if (!hasExplicitProdVar) {
      return {
        commit: '0000000000000000000000000000000000000000',
        commitSource: isTest ? 'test' : 'development',
        deploymentShaStatus: 'development',
        buildTime: new Date().toISOString(),
        isValid: true,
      };
    }
  }

  // If explicit empty strings were passed for all sources (e.g. testing missing SHA), do not fall back to build-info.json
  const explicitEmptyCheck =
    env.APP_COMMIT_SHA === '' &&
    env.VERCEL_GIT_COMMIT_SHA === '' &&
    env.GITHUB_SHA === '' &&
    env.SOURCE_VERSION === '' &&
    env.NEXT_PUBLIC_COMMIT_SHA === '';

  const buildInfo = isProd && !explicitEmptyCheck ? getBuildInfo() : null;

  const candidates: Array<{ source: string; value: string | undefined }> = [
    { source: 'APP_COMMIT_SHA', value: env.APP_COMMIT_SHA },
    { source: 'VERCEL_GIT_COMMIT_SHA', value: env.VERCEL_GIT_COMMIT_SHA },
    { source: 'GITHUB_SHA', value: env.GITHUB_SHA },
    { source: 'SOURCE_VERSION', value: env.SOURCE_VERSION },
    {
      source: 'APPWRITE_DEPLOYMENT_COMMIT',
      value: env.APPWRITE_DEPLOYMENT_COMMIT,
    },
    { source: 'NEXT_PUBLIC_COMMIT_SHA', value: env.NEXT_PUBLIC_COMMIT_SHA },
    { source: 'build-info.json', value: buildInfo?.commit },
  ];

  const buildTime = env.BUILD_TIME || buildInfo?.buildTime || null;

  for (const candidate of candidates) {
    if (candidate.value && typeof candidate.value === 'string') {
      const trimmed = candidate.value.trim().toLowerCase();
      if (SHA_40_REGEX.test(trimmed)) {
        return {
          commit: trimmed,
          commitSource: candidate.source,
          deploymentShaStatus: 'verified',
          buildTime,
          isValid: true,
        };
      }
      // Present but invalid format
      return {
        commit: null,
        commitSource: candidate.source,
        deploymentShaStatus: 'invalid',
        buildTime,
        isValid: false,
      };
    }
  }

  // Missing SHA in production
  return {
    commit: null,
    commitSource: null,
    deploymentShaStatus: 'missing',
    buildTime,
    isValid: false,
  };
}
