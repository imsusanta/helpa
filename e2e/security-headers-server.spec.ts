import { test, expect } from '@playwright/test';

test.describe('E2E Server-Level Security & Cache-Control Headers', () => {
  const privateRoutes = [
    '/dashboard',
    '/inbox',
    '/patients',
    '/appointments',
    '/bookings',
    '/automations',
    '/broadcasts',
    '/pipelines',
    '/settings',
  ];

  test('verifies public health status endpoint returns 200 with private no-store cache headers', async ({
    request,
  }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('private');
  });

  test('verifies unauthenticated access to private routes redirects safely without leaking patient content', async ({
    request,
  }) => {
    for (const route of privateRoutes) {
      const response = await request.get(route, { maxRedirects: 0 });
      // Next.js middleware redirects unauthenticated users to /login
      expect([302, 307, 308]).toContain(response.status());

      const location = response.headers()['location'];
      expect(location).toBeDefined();
      expect(location).toContain('/login');

      const cacheControl = response.headers()['cache-control'];
      if (cacheControl) {
        expect(cacheControl).toContain('no-store');
      }
    }
  });

  test('verifies unauthorized direct access to signed PDF endpoint fails closed with no-store headers', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/appointments/00000000-0000-0000-0000-000000000001/pdf'
    );
    expect([401, 404]).toContain(response.status());

    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('no-store');
  });

  test('verifies unauthenticated WhatsApp webhook POST fails closed with 401 and no-store headers', async ({
    request,
  }) => {
    const response = await request.post('/api/whatsapp/webhook', {
      data: { object: 'whatsapp_business_account' },
    });

    expect(response.status()).toBe(401);
    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('no-store');
  });
});
