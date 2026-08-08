import { test, expect } from '@playwright/test';

test.describe('E2E: Public Routes & Authentication Protection', () => {
  test('landing page loads with clinic branding and navigation affordances', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Helpa/i);

    // Verify main CTA and header links
    const getStartedLink = page.getByRole('link', { name: /start free|get started|open dashboard/i }).first();
    await expect(getStartedLink).toBeVisible();

    // Verify presence of feature sections
    const mainHeading = page.getByRole('heading', { level: 1 });
    await expect(mainHeading).toBeVisible();
  });

  test('login page contains standard credential fields and submit button', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/login|sign in|helpa/i);

    const emailInput = page.getByPlaceholder(/name@hospital\.com|email|your email/i).first();
    const passwordInput = page.getByPlaceholder(/••••••••|password/i).first();
    const submitBtn = page.getByRole('button', { name: /sign in|log in/i }).first();

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  test('public legal and compliance pages are accessible without authentication', async ({ page }) => {
    for (const legalPath of ['/privacy', '/terms', '/refund']) {
      const response = await page.goto(legalPath);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('unauthenticated visitors attempting to access private routes are redirected to login', async ({ page }) => {
    const protectedRoutes = ['/dashboard', '/inbox', '/patients', '/appointments', '/doctors', '/settings'];
    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('public health status endpoint returns 200 OK and JSON status', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});
