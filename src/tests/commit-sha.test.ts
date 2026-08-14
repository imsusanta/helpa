import { describe, it, expect } from 'vitest';
import { resolveCommitSha } from '@/lib/commit-sha';

describe('resolveCommitSha', () => {
  const validSha = 'a7fdfd7633dadda4899a9b827abae813782b5172';

  it('resolves valid APP_COMMIT_SHA with highest precedence', () => {
    const res = resolveCommitSha({
      APP_COMMIT_SHA: validSha,
      VERCEL_GIT_COMMIT_SHA: '1111111111111111111111111111111111111111',
      GITHUB_SHA: '0000000000000000000000000000000000000000',
      NODE_ENV: 'production',
    });
    expect(res.commit).toBe(validSha);
    expect(res.commitSource).toBe('APP_COMMIT_SHA');
    expect(res.deploymentShaStatus).toBe('verified');
    expect(res.isValid).toBe(true);
  });

  it('falls back to VERCEL_GIT_COMMIT_SHA when APP_COMMIT_SHA is missing', () => {
    const res = resolveCommitSha({
      VERCEL_GIT_COMMIT_SHA: validSha,
      GITHUB_SHA: '0000000000000000000000000000000000000000',
      NODE_ENV: 'production',
    });
    expect(res.commit).toBe(validSha);
    expect(res.commitSource).toBe('VERCEL_GIT_COMMIT_SHA');
    expect(res.deploymentShaStatus).toBe('verified');
    expect(res.isValid).toBe(true);
  });

  it('falls back to GITHUB_SHA when earlier candidates are missing', () => {
    const res = resolveCommitSha({
      GITHUB_SHA: validSha,
      NODE_ENV: 'production',
    });
    expect(res.commit).toBe(validSha);
    expect(res.commitSource).toBe('GITHUB_SHA');
    expect(res.deploymentShaStatus).toBe('verified');
    expect(res.isValid).toBe(true);
  });

  it('falls back to SOURCE_VERSION for Appwrite Sites / generic containers', () => {
    const res = resolveCommitSha({
      SOURCE_VERSION: validSha,
      NODE_ENV: 'production',
    });
    expect(res.commit).toBe(validSha);
    expect(res.commitSource).toBe('SOURCE_VERSION');
    expect(res.deploymentShaStatus).toBe('verified');
    expect(res.isValid).toBe(true);
  });

  it('flags invalid SHA format (short or non-hex)', () => {
    const res = resolveCommitSha({
      APP_COMMIT_SHA: 'not-a-valid-sha-12345',
      NODE_ENV: 'production',
    });
    expect(res.commit).toBeNull();
    expect(res.commitSource).toBe('APP_COMMIT_SHA');
    expect(res.deploymentShaStatus).toBe('invalid');
    expect(res.isValid).toBe(false);
  });

  it('reports missing SHA when in production environment and no valid source exists', () => {
    const res = resolveCommitSha({
      NODE_ENV: 'production',
      APP_COMMIT_SHA: '',
      VERCEL_GIT_COMMIT_SHA: '',
      GITHUB_SHA: '',
      SOURCE_VERSION: '',
      NEXT_PUBLIC_COMMIT_SHA: '',
    });
    expect(res.commit).toBeNull();
    expect(res.commitSource).toBeNull();
    expect(res.deploymentShaStatus).toBe('missing');
    expect(res.isValid).toBe(false);
  });

  it('reports development status when in non-production environment', () => {
    const res = resolveCommitSha({
      NODE_ENV: 'development',
    });
    expect(res.commit).toBe('0000000000000000000000000000000000000000');
    expect(res.deploymentShaStatus).toBe('development');
    expect(res.isValid).toBe(true);
  });
});
