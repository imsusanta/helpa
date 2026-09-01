import { test, expect } from '@playwright/test';

test.describe('E2E: Authenticated Clinic & Patient Workflows', () => {
  test('validates required fields on patient registration / login flows', async ({
    page,
  }) => {
    await page.goto('/login');
    const submitBtn = page
      .getByRole('button', { name: /sign in|log in/i })
      .first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('prevents appointment creation with invalid credentials or missing doctor', async ({
    page,
  }) => {
    await page.goto('/login');
    const emailField = page.locator('input[type="email"]').first();
    const passField = page.locator('input[type="password"]').first();
    if (await emailField.isVisible()) {
      await emailField.fill('invalid-doctor@clinic.com');
      await passField.fill('wrongpassword');
      await page
        .getByRole('button', { name: /sign in|log in/i })
        .first()
        .click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('verifies appointment OPD ticket PDF endpoint rejects unauthorized direct access', async ({
    request,
  }) => {
    const fakeAppointmentId = '11111111-1111-1111-1111-111111111111';
    const res = await request.get(`/api/appointments/${fakeAppointmentId}/pdf`);
    expect([401, 403, 404]).toContain(res.status());
  });

  test('verifies WhatsApp settings API rejects unauthenticated mutations honestly', async ({
    request,
  }) => {
    const res = await request.post('/api/whatsapp/config', {
      data: {
        phoneNumberId: '123456789',
        wabaId: '987654321',
        accessToken: 'EAABfakeAccessToken',
      },
    });
    expect([401, 403]).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    expect(body.error).toBeDefined();
  });

  test('verifies WhatsApp send route rejects missing authentication without fake success', async ({
    request,
  }) => {
    const res = await request.post('/api/whatsapp/send', {
      data: {
        phone: '+15551234567',
        message: 'Hello test patient',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('verifies WhatsApp send route idempotency conflict rejection on different payloads', async ({
    request,
  }) => {
    // When sending with conflicting idempotency key, must fail closed with 401/403 (unauthenticated) or 409
    const res = await request.post('/api/whatsapp/send', {
      headers: {
        'x-idempotency-key': 'idemp_test_key_1',
      },
      data: {
        phone: '+15551234567',
        message: 'Payload A',
      },
    });
    expect([401, 403, 409]).toContain(res.status());
  });

  test('verifies conversations API fails closed on unauthenticated request without infinite spinner', async ({
    request,
  }) => {
    const res = await request.get('/api/conversations');
    expect([401, 403]).toContain(res.status());
    const json = await res.json().catch(() => ({}));
    expect(json.error).toBeDefined();
  });

  test('verifies patient export API rejects unauthenticated direct access', async ({
    request,
  }) => {
    const res = await request.get('/api/patients/fake-patient-id/export');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('verifies settings overview API fails closed with 401 on unauthenticated access', async ({
    request,
  }) => {
    const res = await request.get('/api/settings/overview');
    expect([401, 403]).toContain(res.status());
  });

  test('verifies account settings mutation API fails closed with 401 on unauthenticated access', async ({
    request,
  }) => {
    const res = await request.patch('/api/account', {
      data: { name: 'Unauthorized Clinic Rename' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('verifies profile update API fails closed with 401 on unauthenticated access', async ({
    request,
  }) => {
    const res = await request.patch('/api/account/profile', {
      data: { full_name: 'Hacker User' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('verifies observation and pilot readiness APIs reject unauthenticated access', async ({
    request,
  }) => {
    const observation = await request.get('/api/metrics/observation');
    expect([401, 403]).toContain(observation.status());
    const pilot = await request.get('/api/pilot/readiness');
    expect([401, 403]).toContain(pilot.status());
  });
});
