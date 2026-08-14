import { describe, it, expect } from 'vitest';
import { resolveCommitSha } from '@/lib/commit-sha';

describe('resolveCommitSha', () => {
  const validSha = 'ea1bbc19500565470fbf78250e899ee9357e8701';

  it('resolves valid Vercel commit SHA with highest precedence', () => {
    const res = resolveCommitSha({
      VERCEL_GIT_COMMIT_SHA: validSha,
      GITHUB_SHA: '0000000000000000000000000000000000000000',
      NODE_ENV: 'production',
    });
    expect(res.commit).toBe(validSha);
    expect(res.deploymentShaStatus).toBe('verified');
    expect(res.isValid).toBe(true);
  });

  it('falls back to GITHUB_SHA when VERCEL_GIT_COMMIT_SHA is missing', () => {
    const res = resolveCommitSha({
      GITHUB_SHA: validSha,
      NODE_ENV: 'production',
    });
    expect(res.commit).toBe(validSha);
    expect(res.deploymentShaStatus).toBe('verified');
    expect(res.isValid).toBe(true);
  });

  it('falls back to APPWRITE_DEPLOYMENT_COMMIT or DEPLOYED_COMMIT_SHA', () => {
    const res = resolveCommitSha({
      DEPLOYED_COMMIT_SHA: validSha,
      NODE_ENV: 'production',
    });
    expect(res.commit).toBe(validSha);
    expect(res.deploymentShaStatus).toBe('verified');
    expect(res.isValid).toBe(true);
  });

  it('flags invalid SHA format (short or non-hex)', () => {
    const res = resolveCommitSha({
      VERCEL_GIT_COMMIT_SHA: 'not-a-valid-sha-12345',
      NODE_ENV: 'production',
    });
    expect(res.commit).toBe('not-a-valid-sha-12345');
    expect(res.deploymentShaStatus).toBe('invalid');
    expect(res.isValid).toBe(false);
  });

  it('reports missing SHA when in production environment and no env var exists', () => {
    const res = resolveCommitSha({
      NODE_ENV: 'production',
    });
    expect(res.commit).toBe('missing');
    expect(res.deploymentShaStatus).toBe('missing');
    expect(res.isValid).toBe(false);
  });

  it('reports development status when in non-production environment', () => {
    const res = resolveCommitSha({
      NODE_ENV: 'development',
    });
    expect(res.commit).toBe('development');
    expect(res.deploymentShaStatus).toBe('development');
    expect(res.isValid).toBe(true);
  });
});
