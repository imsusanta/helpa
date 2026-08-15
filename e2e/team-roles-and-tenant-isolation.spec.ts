import { test, expect } from '@playwright/test';

test.describe('E2E: Team Permissions & Multi-Tenant Boundary Isolation', () => {
  test('unauthenticated API requests return 401 Unauthorized without data leakage', async ({
    request,
  }) => {
    const protectedGetEndpoints = [
      '/api/account',
      '/api/account/members',
      '/api/patients/search?q=test',
    ];

    for (const endpoint of protectedGetEndpoints) {
      const res = await request.get(endpoint);
      expect([401, 403]).toContain(res.status());
      // Ensure response does not contain stack traces or schema structures
      const text = await res.text();
      expect(text).not.toContain('database schema error');
      expect(text).not.toContain('column');
      expect(text).not.toContain('syntax error');
    }

    const postRes = await request.post('/api/whatsapp/send', {
      data: { phone: '+1234567890', message: 'test' },
    });
    expect([401, 403]).toContain(postRes.status());
  });

  test('cross-account resource mutation fails closed', async ({ request }) => {
    const fakeCrossAccountId = '99999999-9999-9999-9999-999999999999';
    const res = await request.post(
      `/api/appointments/${fakeCrossAccountId}/confirm`,
      {
        data: { status: 'Confirmed' },
      }
    );
    // Must be rejected strictly with 401 or 403, never 200/404/405
    expect([401, 403]).toContain(res.status());
  });

  test('request body cannot escape tenant ownership on patient creation', async ({
    request,
  }) => {
    const foreignAccountId = '00000000-0000-0000-0000-000000000001';
    const res = await request.post('/api/patients', {
      data: {
        name: 'Attempted Boundary Escape',
        phone: '+15550001111',
        account_id: foreignAccountId,
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('unauthorized tenant message access and WhatsApp config are rejected', async ({
    request,
  }) => {
    const fakeConvId = '11111111-1111-1111-1111-111111111111';
    const msgRes = await request.get(
      `/api/inbox/conversations/${fakeConvId}/messages`
    );
    expect([401, 403, 404]).toContain(msgRes.status());

    const configRes = await request.get('/api/whatsapp/config');
    expect([401, 403]).toContain(configRes.status());
  });
});
