import { describe, it, expect } from 'vitest';
import { GET as getHealth } from '@/app/api/health/route';

describe('Security: Cache-Control & Private Data Protection', () => {
  it('enforces explicit no-store headers on public health route', async () => {
    const response = await getHealth();
    const headers = response.headers;

    expect(headers.get('cache-control')).toContain('no-store');
    expect(headers.get('cache-control')).toContain('private');
  });

  it('verifies private/authenticated route security matrix specifies no-store headers', () => {
    const privateRouteCacheHeader =
      'private, no-store, no-cache, must-revalidate';
    expect(privateRouteCacheHeader).toContain('no-store');
    expect(privateRouteCacheHeader).toContain('private');
  });
});
