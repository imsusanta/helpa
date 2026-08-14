export interface CommitResolution {
  commit: string;
  deploymentShaStatus: 'verified' | 'missing' | 'invalid' | 'development';
  isValid: boolean;
}

const SHA_40_REGEX = /^[0-9a-f]{40}$/i;

/**
 * Resolves the active deployment commit SHA strictly in order of precedence:
 * 1. VERCEL_GIT_COMMIT_SHA (Vercel deployment platform)
 * 2. GITHUB_SHA (GitHub Actions CI/CD)
 * 3. APPWRITE_DEPLOYMENT_COMMIT (Appwrite deployment engine)
 * 4. DEPLOYED_COMMIT_SHA (Server-only explicit commit environment variable)
 * 5. NEXT_PUBLIC_COMMIT_SHA (Build-time inlined fallback)
 */
export function resolveCommitSha(
  env: NodeJS.ProcessEnv = process.env
): CommitResolution {
  const isProd = env.NODE_ENV === 'production';

  const rawCandidate =
    env.VERCEL_GIT_COMMIT_SHA ||
    env.GITHUB_SHA ||
    env.APPWRITE_DEPLOYMENT_COMMIT ||
    env.DEPLOYED_COMMIT_SHA ||
    env.NEXT_PUBLIC_COMMIT_SHA;

  if (rawCandidate && typeof rawCandidate === 'string') {
    const trimmed = rawCandidate.trim().toLowerCase();
    if (SHA_40_REGEX.test(trimmed)) {
      return {
        commit: trimmed,
        deploymentShaStatus: 'verified',
        isValid: true,
      };
    }
    // Present but not a valid 40-character hex SHA
    return {
      commit: trimmed,
      deploymentShaStatus: 'invalid',
      isValid: false,
    };
  }

  // Missing SHA
  if (isProd) {
    return {
      commit: 'missing',
      deploymentShaStatus: 'missing',
      isValid: false,
    };
  }

  return {
    commit:
      env.NODE_ENV === 'test'
        ? '0000000000000000000000000000000000000000'
        : 'development',
    deploymentShaStatus: 'development',
    isValid: true,
  };
}
