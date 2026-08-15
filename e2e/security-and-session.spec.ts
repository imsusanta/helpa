import { test, expect } from '@playwright/test';

test.describe('E2E: Production Security, Secret Leakage & Session Protection', () => {
  test('landing page and login page do not expose service-role secrets in client HTML or script tags', async ({
    page,
  }) => {
    await page.goto('/');
    const html = await page.content();

    // Check that sensitive patterns are never rendered in client HTML
    expect(html).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(html).not.toContain('ci-test-supabase-service-role-key');
    expect(html).not.toContain('APPWRITE_API_KEY');
    expect(html).not.toContain('META_APP_SECRET');
    expect(html).not.toContain('standard_');

    await page.goto('/login');
    const loginHtml = await page.content();
    expect(loginHtml).not.toContain('ci-test-supabase-service-role-key');
    expect(loginHtml).not.toContain('META_APP_SECRET');
  });

  test('rejects forged account ID in cookies or headers when accessing settings', async ({
    request,
  }) => {
    const res = await request.get('/api/settings/overview', {
      headers: {
        'x-account-id': '00000000-0000-0000-0000-000000000999',
        'x-tenant-id': '00000000-0000-0000-0000-000000000999',
      },
    });
    expect([401, 403]).toContain(res.status());
    const data = await res.json().catch(() => ({}));
    expect(data.data).toBeUndefined();
  });

  test('rejects unauthenticated outbound WhatsApp message creation without credentials', async ({
    request,
  }) => {
    const res = await request.post('/api/whatsapp/send', {
      data: {
        recipient: '+919876543210',
        message: 'Security test outbound message',
        idempotencyKey: 'sec-test-key-1',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('validates that /api/health/live returns fast liveness status with no-store cache headers', async ({
    request,
  }) => {
    const res = await request.get('/api/health/live');
    expect(res.status()).toBe(200);
    const cacheControl = res.headers()['cache-control'];
    expect(cacheControl).toContain('no-store');
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.version).toBeDefined();
  });
});
