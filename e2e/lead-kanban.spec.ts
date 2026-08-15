import { test, expect } from '@playwright/test';

test.describe('E2E: Helpa Premium Lead Kanban & Drawer Workflow', () => {
  test('opens lead pipeline or redirects safely for unauthenticated users', async ({
    page,
    request,
  }) => {
    await page.goto('/leads');
    await expect(page).toHaveURL(/\/(leads|login)/);

    // Verify stage transition API boundary rejects unauthorized request
    const apiRes = await request.post(
      '/api/leads/00000000-0000-0000-0000-000000000099/stage',
      {
        data: { nextStage: 'QUALIFIED' },
      }
    );
    expect([400, 401, 403, 404]).toContain(apiRes.status());
  });
});
