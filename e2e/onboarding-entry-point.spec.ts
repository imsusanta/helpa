import { test, expect } from '@playwright/test';

const mockOwnerProfile = {
  success: true,
  user: {
    id: 'user-owner-1',
    email: 'owner@clinic.com',
  },
  profile: {
    id: 'user-owner-1',
    full_name: 'Dr. Owner',
    email: 'owner@clinic.com',
    avatar_url: null,
    role: 'owner',
    account_id: 'acc-owner-1',
    account_role: 'owner',
    is_super_admin: false,
    beta_features: [],
  },
  account: {
    id: 'acc-owner-1',
    name: 'Care Wellness Clinic',
    default_currency: 'INR',
    industry: 'hospital_clinic',
  },
  enabled_modules: ['dashboard', 'inbox', 'appointments', 'settings'],
};

const mockAgentProfile = {
  success: true,
  user: {
    id: 'user-agent-1',
    email: 'agent@clinic.com',
  },
  profile: {
    id: 'user-agent-1',
    full_name: 'Front Desk Agent',
    email: 'agent@clinic.com',
    avatar_url: null,
    role: 'agent',
    account_id: 'acc-owner-1',
    account_role: 'agent',
    is_super_admin: false,
    beta_features: [],
  },
  account: {
    id: 'acc-owner-1',
    name: 'Care Wellness Clinic',
    default_currency: 'INR',
    industry: 'hospital_clinic',
  },
  enabled_modules: ['dashboard', 'inbox'],
};

test.describe('E2E: Onboarding Entry-Point & Eligibility Gate', () => {
  test.describe('Desktop Viewport (1280x800)', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('reaches authenticated dashboard and strictly requires wizard dialog for eligible owner', async ({
      page,
      context,
    }) => {
      // Set test session cookie for proxy middleware bypass
      await context.addCookies([
        {
          name: 'playwright_test_session',
          value: 'user-owner-1',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Generic account API fallback
      await page.route('**/api/account/**', async (route) => {
        const url = route.request().url();
        if (url.includes('profile') || url.includes('onboarding-status')) {
          return route.fallback();
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      });

      // Explicit intercepts (registered after general so they match first in Playwright)
      await page.route('**/api/account/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockOwnerProfile),
        });
      });

      await page.route('**/api/account/onboarding-status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            needs_onboarding: true,
            completed_at: null,
            exempted_at: null,
          }),
        });
      });

      await page.route('**/api/whatsapp/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ connected: false }),
        });
      });

      await page.goto('/dashboard');

      // Strict assertions - MUST reach dashboard without redirect to login
      expect(page.url()).not.toContain('/login');
      expect(page.url()).toContain('/dashboard');

      // The wizard dialog MUST be strictly visible
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByText(/Step 1 of 6/i)).toBeVisible();

      // Defer flow: clicking 'Finish later' hides the dialog and reveals 'Resume Setup'
      const finishLaterBtn = page.getByRole('button', { name: /Finish later/i });
      await expect(finishLaterBtn).toBeVisible();
      await finishLaterBtn.click();

      await expect(dialog).not.toBeVisible();

      // Resume flow: checklist contains 'Resume Setup' button for owners
      const resumeBtn = page.getByRole('button', { name: /Resume Setup/i });
      await expect(resumeBtn).toBeVisible();

      // Clicking 'Resume Setup' re-opens the wizard
      await resumeBtn.click();
      await expect(dialog).toBeVisible();
      await expect(page.getByText(/Step 1 of 6/i)).toBeVisible();
    });

    test('does not show onboarding overlay when needs_onboarding is false for owner', async ({
      page,
      context,
    }) => {
      await context.addCookies([
        {
          name: 'playwright_test_session',
          value: 'user-owner-1',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Generic account API fallback
      await page.route('**/api/account/**', async (route) => {
        const url = route.request().url();
        if (url.includes('profile') || url.includes('onboarding-status')) {
          return route.fallback();
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      });

      await page.route('**/api/account/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockOwnerProfile),
        });
      });

      await page.route('**/api/account/onboarding-status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            needs_onboarding: false,
            completed_at: '2026-09-01T10:00:00Z',
            exempted_at: null,
          }),
        });
      });

      await page.route('**/api/whatsapp/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ connected: false }),
        });
      });

      await page.goto('/dashboard');
      expect(page.url()).not.toContain('/login');
      expect(page.url()).toContain('/dashboard');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText(/Step 1 of 6/i)).not.toBeVisible();
    });

    test('non-owner (agent) never sees onboarding overlay or resume button even if workspace needs onboarding', async ({
      page,
      context,
    }) => {
      await context.addCookies([
        {
          name: 'playwright_test_session',
          value: 'user-agent-1',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Generic account API fallback
      await page.route('**/api/account/**', async (route) => {
        const url = route.request().url();
        if (url.includes('profile') || url.includes('onboarding-status')) {
          return route.fallback();
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      });

      await page.route('**/api/account/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAgentProfile),
        });
      });

      await page.route('**/api/account/onboarding-status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            needs_onboarding: true,
            completed_at: null,
            exempted_at: null,
          }),
        });
      });

      await page.route('**/api/whatsapp/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ connected: false }),
        });
      });

      await page.goto('/dashboard');
      expect(page.url()).not.toContain('/login');
      expect(page.url()).toContain('/dashboard');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByRole('button', { name: /Resume Setup/i })).not.toBeVisible();
    });
  });

  test.describe('Mobile Viewport (375x667)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('mobile layout does not suffer from horizontal overflow on login and public routes', async ({
      page,
    }) => {
      await page.goto('/login');
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 5);
    });
  });
});
