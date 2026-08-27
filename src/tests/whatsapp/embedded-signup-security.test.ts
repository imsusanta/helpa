import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  checkRateLimit: vi.fn(),
  validateAndConsumeOAuthState: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
  debugAccessToken: vi.fn(),
  getWabaPhoneNumbers: vi.fn(),
  getPhoneNumberDetails: vi.fn(),
  subscribeWabaWebhook: vi.fn(),
  getAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: mocks.requireRole,
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { adminAction: { limit: 10, windowMs: 60_000 } },
  checkRateLimit: mocks.checkRateLimit,
  rateLimitResponse: vi.fn(() =>
    Response.json({ error: 'rate limited' }, { status: 429 })
  ),
}));

vi.mock('@/lib/whatsapp/oauth-state', () => ({
  validateAndConsumeOAuthState: mocks.validateAndConsumeOAuthState,
}));

vi.mock('@/lib/whatsapp/meta-service', () => ({
  exchangeAuthorizationCode: mocks.exchangeAuthorizationCode,
  debugAccessToken: mocks.debugAccessToken,
  getWabaPhoneNumbers: mocks.getWabaPhoneNumbers,
  getPhoneNumberDetails: mocks.getPhoneNumberDetails,
  subscribeWabaWebhook: mocks.subscribeWabaWebhook,
}));

vi.mock('@/lib/whatsapp/encryption', () => ({
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
}));

vi.mock('@/lib/supabase/server', () => ({
  getAdminClient: mocks.getAdminClient,
}));

import { POST } from '@/app/api/whatsapp/embedded-signup/route';

function request(body: Record<string, unknown>): Request {
  return new Request('https://helpa.test/api/whatsapp/embedded-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('WhatsApp Embedded Signup security boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('META_APP_ID', 'meta-app-123');
    vi.stubEnv('META_APP_SECRET', 'meta-secret');

    mocks.requireRole.mockResolvedValue({
      accountId: 'account-1',
      userId: 'user-1',
    });
    mocks.checkRateLimit.mockResolvedValue({ success: true });
    mocks.validateAndConsumeOAuthState.mockResolvedValue({
      id: 'state-1',
      accountId: 'account-1',
      userId: 'user-1',
      state: 'valid-state',
      createdAt: new Date().toISOString(),
    });
    mocks.debugAccessToken.mockResolvedValue({
      isValid: true,
      appId: 'meta-app-123',
      wabaId: 'waba-1',
      scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    });
    mocks.getWabaPhoneNumbers.mockResolvedValue([
      { id: 'phone-1', display_phone_number: '+91 99999 99999' },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects a callback without OAuth state', async () => {
    const response = await POST(request({ accessToken: 'token' }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe('INVALID_OAUTH_STATE');
    expect(mocks.validateAndConsumeOAuthState).not.toHaveBeenCalled();
    expect(mocks.debugAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a token issued to another Meta app', async () => {
    mocks.debugAccessToken.mockResolvedValue({
      isValid: true,
      appId: 'foreign-app',
      wabaId: 'waba-1',
      scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    });

    const response = await POST(
      request({ state: 'valid-state', accessToken: 'foreign-token' })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.code).toBe('META_APP_MISMATCH');
    expect(mocks.getWabaPhoneNumbers).not.toHaveBeenCalled();
  });

  it('rejects a token missing required WhatsApp permissions', async () => {
    mocks.debugAccessToken.mockResolvedValue({
      isValid: true,
      appId: 'meta-app-123',
      wabaId: 'waba-1',
      scopes: ['whatsapp_business_management'],
    });

    const response = await POST(
      request({ state: 'valid-state', accessToken: 'limited-token' })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.code).toBe('META_SCOPES_MISSING');
  });

  it('rejects a phone number outside the selected WABA', async () => {
    const response = await POST(
      request({
        state: 'valid-state',
        accessToken: 'valid-token',
        waba_id: 'waba-1',
        phone_number_id: 'phone-from-another-waba',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe('PHONE_WABA_MISMATCH');
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });
});
