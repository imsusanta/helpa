import { test, expect } from '@playwright/test';

test.describe('E2E: Inbox Conversations & Tenant Boundaries', () => {
  test('verifies unauthenticated /api/inbox/conversations returns 401 Unauthorized', async ({
    request,
  }) => {
    const response = await request.get('/api/inbox/conversations');
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toMatch(/unauthorized/i);
  });

  test('verifies unauthenticated /api/inbox/conversations/:id returns 401 Unauthorized', async ({
    request,
  }) => {
    const response = await request.get('/api/inbox/conversations/conv_123');
    expect(response.status()).toBe(401);
  });

  test('verifies unauthenticated /api/inbox/conversations/:id/messages returns 401 Unauthorized', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/inbox/conversations/conv_123/messages'
    );
    expect(response.status()).toBe(401);
  });

  test('verifies unauthenticated PATCH /api/inbox/conversations/:id returns 401 Unauthorized', async ({
    request,
  }) => {
    const response = await request.patch('/api/inbox/conversations/conv_123', {
      data: { status: 'closed' },
    });
    expect(response.status()).toBe(401);
  });

  test('verifies unauthenticated user navigating to /inbox is redirected to login', async ({
    page,
  }) => {
    await page.goto('/inbox');
    await expect(page).toHaveURL(/\/login/);
  });
});
