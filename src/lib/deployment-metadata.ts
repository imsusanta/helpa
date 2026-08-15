import fs from 'fs';
import path from 'path';

export type DeploymentShaStatus = 'available' | 'missing' | 'invalid';

export interface DeploymentMetadata {
  status: 'ok' | 'degraded';
  version: string;
  commit: string | null;
  deploymentShaStatus: DeploymentShaStatus;
  commitSource:
    | 'vercel'
    | 'github_actions'
    | 'deployment_env'
    | 'appwrite'
    | 'git'
    | string
    | null;
  environment: string;
  buildTime: string | null;
  isValid: boolean;
}

const SHA_40_REGEX = /^[0-9a-f]{40}$/i;
const ZERO_SHA_REGEX = /^0{40}$/;
const VERSION = '0.3.0';

interface BuildMetadataFile {
  commit?: string | null;
  commitSource?: string | null;
  deploymentShaStatus?: DeploymentShaStatus;
  buildTime?: string | null;
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
        const parsed = JSON.parse(content);
        if (parsed?.commit && !ZERO_SHA_REGEX.test(parsed.commit)) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

function normalizeSource(source: string): string {
  if (source === 'VERCEL_GIT_COMMIT_SHA') return 'vercel';
  if (source === 'GITHUB_SHA') return 'github_actions';
  if (source === 'APP_COMMIT_SHA' || source === 'DEPLOYMENT_GIT_SHA')
    return 'deployment_env';
  if (source === 'SOURCE_VERSION' || source === 'APPWRITE_GIT_COMMIT_SHA')
    return 'appwrite';
  if (source === 'git rev-parse HEAD' || source === 'git') return 'git';
  return source;
}

/**
 * Resolves deployment metadata strictly in order of precedence:
 * 1. APP_COMMIT_SHA (Explicit server-only canonical deployment variable)
 * 2. VERCEL_GIT_COMMIT_SHA (Vercel deployment platform)
 * 3. GITHUB_SHA (GitHub Actions CI/CD)
 * 4. DEPLOYMENT_GIT_SHA (Injected by CI / deployment)
 * 5. SOURCE_VERSION (Appwrite / generic container deployment engine)
 * 6. src/lib/build-metadata.json (Generated during prebuild / next build)
 * 7. NEXT_PUBLIC_COMMIT_SHA (Build-time inlined fallback)
 */
export function getDeploymentMetadata(
  env: NodeJS.ProcessEnv = process.env
): DeploymentMetadata {
  const isProd = env.NODE_ENV === 'production';
  const environment = env.NODE_ENV || 'production';

  // If in development or test with no explicit production vars, return dev identity
  if (!isProd) {
    const hasExplicitVar = Boolean(
      env.APP_COMMIT_SHA ||
      env.VERCEL_GIT_COMMIT_SHA ||
      env.GITHUB_SHA ||
      env.DEPLOYMENT_GIT_SHA ||
      env.SOURCE_VERSION
    );

    if (!hasExplicitVar) {
      return {
        status: 'ok',
        version: VERSION,
        commit: null,
        deploymentShaStatus: 'missing',
        commitSource: 'development',
        environment,
        buildTime: new Date().toISOString(),
        isValid: true,
      };
    }
  }

  // If any candidate env var is explicitly empty string, don't fall back to build metadata file
  const isExplicitlyCleared =
    env.APP_COMMIT_SHA === '' ||
    env.VERCEL_GIT_COMMIT_SHA === '' ||
    env.GITHUB_SHA === '';

  const buildMeta = isProd && !isExplicitlyCleared ? readBuildMetadata() : null;

  const candidates: Array<{
    source: string;
    value: string | null | undefined;
  }> = [
    { source: 'APP_COMMIT_SHA', value: env.APP_COMMIT_SHA },
    { source: 'VERCEL_GIT_COMMIT_SHA', value: env.VERCEL_GIT_COMMIT_SHA },
    { source: 'GITHUB_SHA', value: env.GITHUB_SHA },
    { source: 'DEPLOYMENT_GIT_SHA', value: env.DEPLOYMENT_GIT_SHA },
    { source: 'SOURCE_VERSION', value: env.SOURCE_VERSION },
    { source: 'build-metadata.json', value: buildMeta?.commit },
    { source: 'NEXT_PUBLIC_COMMIT_SHA', value: env.NEXT_PUBLIC_COMMIT_SHA },
  ];

  const buildTime =
    env.BUILD_TIME || buildMeta?.buildTime || new Date().toISOString();

  for (const candidate of candidates) {
    if (candidate.value && typeof candidate.value === 'string') {
      const trimmed = candidate.value.trim().toLowerCase();

      // Reject all-zero SHA, "unknown", "development", or malformed
      if (
        ZERO_SHA_REGEX.test(trimmed) ||
        trimmed === 'unknown' ||
        trimmed === 'development' ||
        trimmed === 'null' ||
        trimmed === 'undefined'
      ) {
        return {
          status: 'degraded',
          version: VERSION,
          commit: null,
          deploymentShaStatus: 'invalid',
          commitSource: normalizeSource(candidate.source),
          environment,
          buildTime,
          isValid: false,
        };
      }

      if (SHA_40_REGEX.test(trimmed)) {
        const source =
          candidate.source === 'build-metadata.json' && buildMeta?.commitSource
            ? normalizeSource(buildMeta.commitSource)
            : normalizeSource(candidate.source);

        return {
          status: 'ok',
          version: VERSION,
          commit: trimmed,
          deploymentShaStatus: 'available',
          commitSource: source,
          environment,
          buildTime,
          isValid: true,
        };
      }

      // Present but not 40-char hex
      return {
        status: 'degraded',
        version: VERSION,
        commit: null,
        deploymentShaStatus: 'invalid',
        commitSource: normalizeSource(candidate.source),
        environment,
        buildTime,
        isValid: false,
      };
    }
  }

  // If in development or test with no SHA configured, report development without zero-padding
  if (!isProd) {
    return {
      status: 'ok',
      version: VERSION,
      commit: null,
      deploymentShaStatus: 'missing',
      commitSource: 'development',
      environment,
      buildTime: new Date().toISOString(),
      isValid: true,
    };
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
