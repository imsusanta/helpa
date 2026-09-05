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

test.describe('E2E: Onboarding Entry-Point & Eligibility Gate (Isolated UI Harness)', () => {
  test.describe('Desktop Viewport (1280x800)', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('reaches dashboard and strictly requires wizard dialog for eligible owner', async ({
      page,
    }) => {
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

      await page.goto('/auth/test-harness?scenario=dispatcher');

      // The wizard dialog MUST be strictly visible
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByText(/Step 1 of 6/i)).toBeVisible();

      // Defer flow: clicking 'Finish later' hides the dialog and reveals 'Resume Setup'
      const finishLaterBtn = page.getByRole('button', {
        name: /Finish later/i,
      });
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
    }) => {
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

      await page.goto('/auth/test-harness?scenario=dispatcher');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText(/Step 1 of 6/i)).not.toBeVisible();
    });

    test('non-owner (agent) never sees onboarding overlay or resume button', async ({
      page,
    }) => {
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

      await page.goto('/auth/test-harness?scenario=dispatcher');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: /Resume Setup/i })
      ).not.toBeVisible();
    });

    test('keyboard navigation and accessible controls through wizard steps', async ({
      page,
    }) => {
      await page.goto('/auth/test-harness?scenario=overlay');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Keyboard navigation: Tab to input, type and press Enter to submit Step 1 form
      const nameInput = page.getByPlaceholder(/e.g. Dr. Sharma Clinic/i);
      await nameInput.focus();
      await nameInput.fill('Dr. Keyboard Practice');
      await nameInput.press('Enter');

      // Enter submits form and advances to Step 2
      await expect(page.getByText(/Step 2 of 6/i)).toBeVisible();

      // Keyboard navigation: Tab to Finish later button and press Enter
      const finishLaterBtn = page.getByRole('button', {
        name: /Finish later/i,
      });
      await finishLaterBtn.focus();
      await page.keyboard.press('Enter');

      // Dialog is dismissed and deferred status is confirmed
      await expect(dialog).not.toBeVisible();
      await expect(page.getByTestId('status-deferred')).toBeVisible();
    });

    test('completion flow and page reload persistence', async ({ page }) => {
      let isCompletedOnServer = false;

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
            needs_onboarding: !isCompletedOnServer,
            completed_at: isCompletedOnServer
              ? '2026-09-05T12:00:00.000Z'
              : null,
            exempted_at: null,
          }),
        });
      });

      await page.route('**/api/account/onboard', async (route) => {
        isCompletedOnServer = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            status: 'completed',
            mutated: true,
            completed_at: '2026-09-05T12:00:00.000Z',
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

      await page.goto('/auth/test-harness?scenario=dispatcher');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Advance through Step 1 to Step 6
      await page.getByRole('button', { name: /Continue/i }).click();
      await expect(page.getByText(/Step 2 of 6/i)).toBeVisible();
      await page.getByRole('button', { name: /Continue/i }).click();
      await expect(page.getByText(/Step 3 of 6/i)).toBeVisible();
      await page.getByRole('button', { name: /Skip for now/i }).click();
      await expect(page.getByText(/Step 4 of 6/i)).toBeVisible();
      await page.getByRole('button', { name: /Continue to Test AI/i }).click();
      await expect(page.getByText(/Step 5 of 6/i)).toBeVisible();
      await page.getByRole('button', { name: /Review Setup/i }).click();
      await expect(page.getByText(/Step 6 of 6/i)).toBeVisible();

      // Submit final completion
      const saveBtn = page.getByRole('button', {
        name: /Save Setup & Open Dashboard/i,
      });
      await expect(saveBtn).toBeVisible();
      await saveBtn.click();

      // Dialog closes upon completion
      await expect(dialog).not.toBeVisible();

      // Reload page — wizard must stay closed because server confirms needs_onboarding is now false
      await page.reload();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('failure and retry handling on server errors', async ({ page }) => {
      let attempts = 0;

      await page.route('**/api/account/onboard', async (route) => {
        attempts++;
        if (attempts === 1) {
          // First attempt fails with 500
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Database lock acquisition timeout',
            }),
          });
        } else {
          // Retry succeeds
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              status: 'completed',
              mutated: true,
            }),
          });
        }
      });

      await page.goto('/auth/test-harness?scenario=overlay');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Ensure business name is provided
      const nameInput = page.getByPlaceholder(/e.g. Dr. Sharma Clinic/i);
      await nameInput.fill('Error Retry Clinic');

      // Fast-forward to step 6
      await page.getByRole('button', { name: /Continue/i }).click();
      await expect(page.getByText(/Step 2 of 6/i)).toBeVisible();
      await page.getByRole('button', { name: /Continue/i }).click();
      await expect(page.getByText(/Step 3 of 6/i)).toBeVisible();
      await page.getByRole('button', { name: /Skip for now/i }).click();
      await expect(page.getByText(/Step 4 of 6/i)).toBeVisible();
      await page.getByRole('button', { name: /Continue to Test AI/i }).click();
      await expect(page.getByText(/Step 5 of 6/i)).toBeVisible();
      await page.getByRole('button', { name: /Review Setup/i }).click();
      await expect(page.getByText(/Step 6 of 6/i)).toBeVisible();

      // Click Save — attempt 1 fails
      await page
        .getByRole('button', { name: /Save Setup & Open Dashboard/i })
        .click();

      // Verify visible error alert banner is rendered with Retry button
      const alert = dialog.getByRole('alert');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText('Database lock acquisition timeout');
      const retryBtn = page.getByRole('button', { name: /Retry Save/i });
      await expect(retryBtn).toBeVisible();

      // Click Retry Save — attempt 2 succeeds
      await retryBtn.click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByTestId('status-completed')).toBeVisible();
    });

    test('settings reconfiguration regression: template switch invokes explicit reconfigure contract', async ({
      page,
    }) => {
      let capturedBody: Record<string, unknown> | null = null;

      await page.route('**/api/account/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockOwnerProfile),
        });
      });

      await page.route('**/api/account/onboard', async (route) => {
        capturedBody = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            status: 'reconfigured',
            mutated: true,
            industry: capturedBody?.industry || 'salon',
          }),
        });
      });

      await page.goto('/auth/test-harness?scenario=settings');

      // Open Change Workspace Template modal
      const changeTemplateBtn = page.getByRole('button', {
        name: /Change Workspace Template/i,
      });
      await expect(changeTemplateBtn).toBeVisible();
      await changeTemplateBtn.click();

      // Modal is visible
      await expect(
        page.getByText(/Change Workspace Business Template/i)
      ).toBeVisible();

      // Select Salon / Beauty template
      const salonCard = page
        .getByRole('button', { name: /Salon & Spa/i })
        .first();
      await expect(salonCard).toBeVisible();
      await salonCard.click();

      // Click Apply Template Configuration
      const applyBtn = page.getByRole('button', {
        name: /Apply Template Configuration/i,
      });
      await expect(applyBtn).toBeVisible();
      await applyBtn.click();

      // Assert explicit reconfigure contract: reconfigure=true and industry=salon
      expect(capturedBody).toBeDefined();
      expect(capturedBody).toHaveProperty('reconfigure', true);
      expect(capturedBody).toHaveProperty('industry', 'salon');
    });
  });

  test.describe('Mobile Viewport (375x667)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('real mobile onboarding wizard is responsive with zero horizontal overflow', async ({
      page,
    }) => {
      await page.goto('/auth/test-harness?scenario=overlay');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify no horizontal overflow in mobile viewport
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 5);

      // Verify step 1 heading and controls fit within viewport
      await expect(page.getByText(/Step 1 of 6/i)).toBeVisible();
      const nameInput = page.getByPlaceholder(/e.g. Dr. Sharma Clinic/i);
      await nameInput.fill('Mobile Test Clinic');
      const continueBtn = page.getByRole('button', { name: /Continue/i });
      await expect(continueBtn).toBeVisible();

      // Advance to step 2 on mobile
      await continueBtn.click();
      await expect(page.getByText(/Step 2 of 6/i)).toBeVisible();

      // Step 2 scroll width still within limits
      const step2Width = await page.evaluate(() => document.body.scrollWidth);
      expect(step2Width).toBeLessThanOrEqual(windowWidth + 5);
    });

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
