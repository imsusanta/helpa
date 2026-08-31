import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { isPublicRoute, proxy } from '@/proxy';

vi.mock('@/lib/runtime-config', () => ({
  getRuntimeConfig: () => ({ authProvider: 'none' }),
  requireSupabasePublicConfig: () => {
    throw new Error('unused');
  },
}));

describe('proxy private-route cache headers', () => {
  it('treats tour-packages as a private workspace route', () => {
    expect(isPublicRoute('/tour-packages')).toBe(false);
    expect(isPublicRoute('/packages')).toBe(false);
  });

  it('redirects unauthenticated tour-packages to login with no-store', async () => {
    const request = new NextRequest('http://localhost/tour-packages');
    const response = await proxy(request);
    expect([302, 307, 308]).toContain(response.status);
    expect(response.headers.get('location')).toContain('/login');
    const cacheControl = response.headers.get('cache-control');
    expect(cacheControl).toContain('private');
    expect(cacheControl).toContain('no-store');
  });
});
