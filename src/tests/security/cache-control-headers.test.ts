import { describe, it, expect, vi } from 'vitest';
import { GET as getHealth } from '@/app/api/health/route';
import { POST as postCleanupWebhooks } from '@/app/api/cron/cleanup-webhooks/route';
import { POST as postWhatsappWebhook } from '@/app/api/whatsapp/webhook/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          abortSignal: vi
            .fn()
            .mockResolvedValue({ data: [{ id: '1' }], error: null }),
        }),
      }),
    }),
  }),
}));

describe('Security: Cache-Control & Private Data Protection', () => {
  it('enforces explicit no-store headers on public health route handler', async () => {
    const response = await getHealth(
      new NextRequest('http://localhost:3000/api/health')
    );
    const cacheControl = response.headers.get('cache-control');

    expect([200, 503]).toContain(response.status);
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('private');
  }, 15000);

  it('enforces no-store cache headers on cron cleanup webhook handler', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/cron/cleanup-webhooks',
      {
        method: 'POST',
        headers: { 'x-cron-secret': 'invalid-secret' },
      }
    );

    const response = await postCleanupWebhooks(req);
    const cacheControl = response.headers.get('cache-control');

    expect([401, 503]).toContain(response.status);
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('no-store');
  });

  it('enforces no-store cache headers on WhatsApp webhook handler', async () => {
    const req = new NextRequest('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      body: JSON.stringify({ object: 'whatsapp_business_account' }),
    });

    const response = await postWhatsappWebhook(req);
    const cacheControl = response.headers.get('cache-control');

    expect(response.status).toBe(401);
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('no-store');
  });
});
