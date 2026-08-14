import fs from 'fs';
import path from 'path';

export type DeploymentShaStatus = 'available' | 'missing' | 'invalid';

export interface DeploymentMetadata {
  status: 'ok' | 'degraded';
  version: string;
  commit: string | null;
  deploymentShaStatus: DeploymentShaStatus;
  commitSource: string | null;
  environment: string;
  buildTime: string | null;
  isValid: boolean;
}

const SHA_40_REGEX = /^[0-9a-f]{40}$/i;
const VERSION = '0.3.0';

interface BuildMetadataFile {
  commit?: string;
  commitSource?: string;
  deploymentShaStatus?: DeploymentShaStatus;
  buildTime?: string;
  environment?: string;
}

function readBuildMetadata(): BuildMetadataFile | null {
  try {
    const paths = [
      path.join(process.cwd(), 'src', 'lib', 'build-metadata.json'),
      path.join(process.cwd(), 'src', 'lib', 'build-info.json'),
    ];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        return JSON.parse(content);
      }
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

/**
 * Resolves deployment metadata strictly in order of precedence:
 * 1. APP_COMMIT_SHA (Explicit server-only canonical deployment variable)
 * 2. VERCEL_GIT_COMMIT_SHA (Vercel deployment platform)
 * 3. GITHUB_SHA (GitHub Actions CI/CD)
 * 4. SOURCE_VERSION (Appwrite / generic container deployment engine)
 * 5. src/lib/build-metadata.json (Generated during prebuild / next build)
 * 6. NEXT_PUBLIC_COMMIT_SHA (Build-time inlined fallback)
 */
export function getDeploymentMetadata(
  env: NodeJS.ProcessEnv = process.env
): DeploymentMetadata {
  const isProd = env.NODE_ENV === 'production';
  const isTest = env.NODE_ENV === 'test';
  const environment = env.NODE_ENV || 'production';

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

  // If explicit empty strings were passed for all sources (e.g. testing missing SHA), do not fall back to file
  const explicitEmptyCheck =
    env.APP_COMMIT_SHA === '' &&
    env.VERCEL_GIT_COMMIT_SHA === '' &&
    env.GITHUB_SHA === '' &&
    env.SOURCE_VERSION === '' &&
    env.NEXT_PUBLIC_COMMIT_SHA === '';

  const buildMeta = isProd && !explicitEmptyCheck ? readBuildMetadata() : null;

  const candidates: Array<{
    source: string;
    value: string | undefined;
  }> = [
    { source: 'APP_COMMIT_SHA', value: env.APP_COMMIT_SHA },
    { source: 'VERCEL_GIT_COMMIT_SHA', value: env.VERCEL_GIT_COMMIT_SHA },
    { source: 'GITHUB_SHA', value: env.GITHUB_SHA },
    { source: 'SOURCE_VERSION', value: env.SOURCE_VERSION },
    { source: 'build-metadata.json', value: buildMeta?.commit },
    { source: 'NEXT_PUBLIC_COMMIT_SHA', value: env.NEXT_PUBLIC_COMMIT_SHA },
  ];

  const buildTime =
    env.BUILD_TIME || buildMeta?.buildTime || new Date().toISOString();

  for (const candidate of candidates) {
    if (candidate.value && typeof candidate.value === 'string') {
      const trimmed = candidate.value.trim().toLowerCase();
      if (SHA_40_REGEX.test(trimmed)) {
        return {
          status: 'ok',
          version: VERSION,
          commit: trimmed,
          deploymentShaStatus: 'available',
          commitSource:
            candidate.source === 'build-metadata.json' &&
            buildMeta?.commitSource
              ? buildMeta.commitSource
              : candidate.source,
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
    buildTime: null,
    isValid: false,
  };
}
