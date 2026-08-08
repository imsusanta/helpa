import { test, expect } from '@playwright/test';

test.describe('E2E: Authentication & Team Invitations', () => {
  test('landing page renders correctly with navigation links and login affordance', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Helpa/i);
    const loginLink = page
      .getByRole('link', { name: /open dashboard|login/i })
      .first();
    await expect(loginLink).toBeVisible();
  });

  test('login page has email and password form fields', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByPlaceholder(/name@hospital.com|email/i).first()
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/••••••••|password/i).first()
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
