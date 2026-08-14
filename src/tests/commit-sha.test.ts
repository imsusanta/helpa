import { describe, it, expect } from 'vitest';
import { getDeploymentMetadata } from '@/lib/deployment-metadata';
import { resolveCommitSha } from '@/lib/commit-sha';

describe('Deployment Metadata & Commit SHA Resolution', () => {
  const validSha = '1443268a958c0a3630456a7fd53bd5cdab7a9e2f';

  it('resolves valid APP_COMMIT_SHA with highest precedence', () => {
    const meta = getDeploymentMetadata({
      APP_COMMIT_SHA: validSha,
      VERCEL_GIT_COMMIT_SHA: '1111111111111111111111111111111111111111',
      GITHUB_SHA: '0000000000000000000000000000000000000000',
      NODE_ENV: 'production',
    });
    expect(meta.commit).toBe(validSha);
    expect(meta.commitSource).toBe('APP_COMMIT_SHA');
    expect(meta.deploymentShaStatus).toBe('available');
    expect(meta.status).toBe('ok');
    expect(meta.isValid).toBe(true);
  });

  it('falls back to VERCEL_GIT_COMMIT_SHA when APP_COMMIT_SHA is missing', () => {
    const meta = getDeploymentMetadata({
      VERCEL_GIT_COMMIT_SHA: validSha,
      GITHUB_SHA: '0000000000000000000000000000000000000000',
      NODE_ENV: 'production',
    });
    expect(meta.commit).toBe(validSha);
    expect(meta.commitSource).toBe('VERCEL_GIT_COMMIT_SHA');
    expect(meta.deploymentShaStatus).toBe('available');
    expect(meta.status).toBe('ok');
    expect(meta.isValid).toBe(true);
  });

  it('falls back to GITHUB_SHA when earlier candidates are missing', () => {
    const meta = getDeploymentMetadata({
      GITHUB_SHA: validSha,
      NODE_ENV: 'production',
    });
    expect(meta.commit).toBe(validSha);
    expect(meta.commitSource).toBe('GITHUB_SHA');
    expect(meta.deploymentShaStatus).toBe('available');
    expect(meta.status).toBe('ok');
    expect(meta.isValid).toBe(true);
  });

  it('falls back to SOURCE_VERSION for Appwrite Sites / generic containers', () => {
    const meta = getDeploymentMetadata({
      SOURCE_VERSION: validSha,
      NODE_ENV: 'production',
    });
    expect(meta.commit).toBe(validSha);
    expect(meta.commitSource).toBe('SOURCE_VERSION');
    expect(meta.deploymentShaStatus).toBe('available');
    expect(meta.status).toBe('ok');
    expect(meta.isValid).toBe(true);
  });

  it('flags invalid SHA format (short or non-hex) as degraded with invalid status', () => {
    const meta = getDeploymentMetadata({
      APP_COMMIT_SHA: 'not-a-valid-sha-12345',
      NODE_ENV: 'production',
    });
    expect(meta.commit).toBeNull();
    expect(meta.commitSource).toBe('APP_COMMIT_SHA');
    expect(meta.deploymentShaStatus).toBe('invalid');
    expect(meta.status).toBe('degraded');
    expect(meta.isValid).toBe(false);
  });

  it('reports missing SHA and degraded status when in production environment and no valid source exists', () => {
    const meta = getDeploymentMetadata({
      NODE_ENV: 'production',
      APP_COMMIT_SHA: '',
      VERCEL_GIT_COMMIT_SHA: '',
      GITHUB_SHA: '',
      SOURCE_VERSION: '',
      NEXT_PUBLIC_COMMIT_SHA: '',
    });
    expect(meta.commit).toBeNull();
    expect(meta.commitSource).toBeNull();
    expect(meta.deploymentShaStatus).toBe('missing');
    expect(meta.status).toBe('degraded');
    expect(meta.isValid).toBe(false);
  });

  it('reports development identity when in non-production environment without prod vars', () => {
    const meta = getDeploymentMetadata({
      NODE_ENV: 'development',
    });
    expect(meta.commit).toBe('0000000000000000000000000000000000000000');
    expect(meta.deploymentShaStatus).toBe('available');
    expect(meta.commitSource).toBe('development');
    expect(meta.isValid).toBe(true);
  });

  it('ensures resolveCommitSha compat helper returns consistent values', () => {
    const res = resolveCommitSha({
      APP_COMMIT_SHA: validSha,
      NODE_ENV: 'production',
    });
    expect(res.commit).toBe(validSha);
    expect(res.deploymentShaStatus).toBe('available');
    expect(res.isValid).toBe(true);
  });
});
