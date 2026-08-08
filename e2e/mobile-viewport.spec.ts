import { test, expect } from '@playwright/test';

test.describe('E2E: Mobile Viewport & Responsive Accessibility', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE viewport

  test('landing page renders cleanly at 375px mobile viewport without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Helpa/i);

    // Verify main CTA is visible and interactive on mobile
    const primaryCta = page.getByRole('link', { name: /start free|get started|open dashboard/i }).first();
    await expect(primaryCta).toBeVisible();

    // Check that horizontal scrolling does not occur on document body
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 5); // tolerance for subpixel scrollbars
  });

  test('login page adapts cleanly to mobile viewport', async ({ page }) => {
    await page.goto('/login');
    const emailField = page.getByPlaceholder(/name@hospital\.com|email/i).first();
    const submitBtn = page.getByRole('button', { name: /sign in|log in/i }).first();

    await expect(emailField).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });
});
