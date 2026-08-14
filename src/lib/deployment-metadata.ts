import fs from 'fs';
import path from 'path';

export type DeploymentShaStatus = 'available' | 'missing' | 'invalid';

export interface DeploymentMetadata {
  status: 'ok' | 'degraded';
  version: string;
  commit: string | null;
  deploymentShaStatus: DeploymentShaStatus;
  commitSource:
    | 'APP_COMMIT_SHA'
    | 'VERCEL_GIT_COMMIT_SHA'
    | 'GITHUB_SHA'
    | 'SOURCE_VERSION'
    | 'build-info.json'
    | 'development'
    | null;
  environment: string;
  buildTime: string | null;
  isValid: boolean;
}

const SHA_40_REGEX = /^[0-9a-f]{40}$/i;
const VERSION = '0.3.0';

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
 * Resolves deployment metadata strictly in order of precedence:
 * 1. APP_COMMIT_SHA (Explicit server-only canonical deployment variable)
 * 2. VERCEL_GIT_COMMIT_SHA (Vercel deployment platform)
 * 3. GITHUB_SHA (GitHub Actions CI/CD)
 * 4. SOURCE_VERSION (Appwrite / generic container deployment engine)
 * 5. src/lib/build-info.json (Generated during next build)
 */
export function getDeploymentMetadata(
  env: NodeJS.ProcessEnv = process.env
): DeploymentMetadata {
  const isProd = env.NODE_ENV === 'production';
  const isTest = env.NODE_ENV === 'test';
  const environment = env.NODE_ENV || 'production';

  // In development/test with no production-like environment variables provided:
  if (!isProd) {
    const hasExplicitProdVar = Boolean(
      env.APP_COMMIT_SHA ||
      env.VERCEL_GIT_COMMIT_SHA ||
      env.GITHUB_SHA ||
      env.SOURCE_VERSION
    );

    if (!hasExplicitProdVar) {
      return {
        status: 'ok',
        version: VERSION,
        commit: isTest
          ? '0000000000000000000000000000000000000000'
          : '0000000000000000000000000000000000000000',
        deploymentShaStatus: 'available',
        commitSource: 'development',
        environment,
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

  const candidates: Array<{
    source:
      | 'APP_COMMIT_SHA'
      | 'VERCEL_GIT_COMMIT_SHA'
      | 'GITHUB_SHA'
      | 'SOURCE_VERSION'
      | 'build-info.json';
    value: string | undefined;
  }> = [
    { source: 'APP_COMMIT_SHA', value: env.APP_COMMIT_SHA },
    { source: 'VERCEL_GIT_COMMIT_SHA', value: env.VERCEL_GIT_COMMIT_SHA },
    { source: 'GITHUB_SHA', value: env.GITHUB_SHA },
    { source: 'SOURCE_VERSION', value: env.SOURCE_VERSION },
    { source: 'build-info.json', value: buildInfo?.commit },
  ];

  const buildTime = env.BUILD_TIME || buildInfo?.buildTime || null;

  for (const candidate of candidates) {
    if (candidate.value && typeof candidate.value === 'string') {
      const trimmed = candidate.value.trim().toLowerCase();
      if (SHA_40_REGEX.test(trimmed)) {
        return {
          status: 'ok',
          version: VERSION,
          commit: trimmed,
          deploymentShaStatus: 'available',
          commitSource: candidate.source,
          environment,
          buildTime,
          isValid: true,
        };
      }
      // Present but invalid format
      return {
        status: 'degraded',
        version: VERSION,
        commit: null,
        deploymentShaStatus: 'invalid',
        commitSource: candidate.source,
        environment,
        buildTime,
        isValid: false,
      };
    }
  }

  // Missing SHA in production
  return {
    status: 'degraded',
    version: VERSION,
    commit: null,
    deploymentShaStatus: 'missing',
    commitSource: null,
    environment,
    buildTime,
    isValid: false,
  };
}
