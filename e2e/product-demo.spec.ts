import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const captureEnabled = process.env.DEMO_CAPTURE === 'true';
const outputDirectory = path.resolve('public/assets/screenshots');

async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page
    .waitForLoadState('networkidle', { timeout: 8_000 })
    .catch(() => undefined);
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}',
  });
  await expect(page.locator('body')).toBeVisible();
}

async function capture(page: Page, fileName: string) {
  await settle(page);
  await page.screenshot({
    path: path.join(outputDirectory, fileName),
    fullPage: false,
    animations: 'disabled',
  });
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await settle(page);
}

test.describe('Product demo evidence capture', () => {
  test.skip(
    !captureEnabled,
    'Set DEMO_CAPTURE=true and provide staging demo credentials to capture evidence'
  );
  test.describe.configure({ mode: 'serial' });

  test('captures the seven clinic workflow views using synthetic data', async ({
    page,
  }) => {
    const email = process.env.DEMO_EMAIL;
    const password = process.env.DEMO_PASSWORD;
    expect(email, 'DEMO_EMAIL is required').toBeTruthy();
    expect(password, 'DEMO_PASSWORD is required').toBeTruthy();

    await mkdir(outputDirectory, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.locator('input[type="email"]').first().fill(email!);
    await page.locator('input[type="password"]').first().fill(password!);
    await page
      .getByRole('button', { name: /sign in|log in/i })
      .first()
      .click();
    await page.waitForURL(/\/(dashboard|inbox)/, { timeout: 20_000 });

    await open(page, '/dashboard');
    await capture(page, '01-clinic-dashboard.png');

    await open(page, '/inbox');
    const appointmentConversation = page.getByText('Aarav Sharma').first();
    if (await appointmentConversation.isVisible().catch(() => false)) {
      await appointmentConversation.click();
    }
    await capture(page, '02-whatsapp-inbox-enquiry.png');

    await open(page, '/appointments');
    const bookingButton = page
      .getByRole('button', { name: /new|book|add appointment/i })
      .first();
    if (await bookingButton.isVisible().catch(() => false)) {
      await bookingButton.click();
    }
    await capture(page, '03-doctor-slot-selection.png');

    await page.keyboard.press('Escape');
    await open(page, '/appointments');
    await capture(page, '04-confirmed-appointment.png');

    await open(page, '/automations');
    await capture(page, '05-reminder-preview.png');

    await open(page, '/inbox');
    const takeoverConversation = page.getByText('Priya Patel').first();
    if (await takeoverConversation.isVisible().catch(() => false)) {
      await takeoverConversation.click();
    }
    await capture(page, '06-staff-takeover.png');

    await open(page, '/follow-ups');
    await capture(page, '07-opd-slip-workflow.png');
  });
});
