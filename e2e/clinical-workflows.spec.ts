import { test, expect } from '@playwright/test';

test.describe('E2E: Clinical Workflows (Patients & Appointments)', () => {
  test('redirects unauthenticated visitor to login when attempting to access patients page', async ({
    page,
  }) => {
    await page.goto('/patients');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects unauthenticated visitor to login when accessing appointments page', async ({
    page,
  }) => {
    await page.goto('/appointments');
    await expect(page).toHaveURL(/\/login/);
  });
});
