import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  exchangeAuthorizationCode,
  debugAccessToken,
  getWabaPhoneNumbers,
  getPhoneNumberDetails,
  subscribeWabaWebhook,
  checkConnectionHealth,
} from '@/lib/whatsapp/meta-service';

describe('Meta WhatsApp Service Layer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. exchangeAuthorizationCode', () => {
    it('successfully exchanges code for a long-lived access token', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'EAABwzLIX_LONG_LIVED_TOKEN_123',
            token_type: 'bearer',
            expires_in: 5184000,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await exchangeAuthorizationCode({
        code: 'AQB_AUTH_CODE_XYZ',
        appId: '1234567890',
        appSecret: 'secret_abcdef',
      });

      expect(result.accessToken).toBe('EAABwzLIX_LONG_LIVED_TOKEN_123');
      expect(result.tokenType).toBe('bearer');
      expect(result.expiresIn).toBe(5184000);
    });

    it('sanitizes and throws clear error on Meta exchange failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: 'This authorization code has been used.',
              type: 'OAuthException',
              code: 100,
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(
        exchangeAuthorizationCode({
          code: 'USED_CODE',
          appId: '1234567890',
          appSecret: 'secret_abcdef',
        })
      ).rejects.toThrow(
        /Meta parameter error: This authorization code has been used/
      );
    });
  });

  describe('2. debugAccessToken', () => {
    it('inspects token and extracts discovered WABA ID from granular scopes', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              app_id: '1234567890',
              is_valid: true,
              scopes: [
                'whatsapp_business_management',
                'whatsapp_business_messaging',
              ],
              granular_scopes: [
                {
                  scope: 'whatsapp_business_management',
                  target_ids: ['998877665544'],
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await debugAccessToken({
        accessToken: 'VALID_TOKEN',
        appId: '1234567890',
        appSecret: 'secret_abcdef',
      });

      expect(result.isValid).toBe(true);
      expect(result.wabaId).toBe('998877665544');
      expect(result.scopes).toContain('whatsapp_business_management');
    });
  });

  describe('3. getWabaPhoneNumbers', () => {
    it('returns phone numbers registered under the WABA', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'phone-100200',
                display_phone_number: '+91 98765 43210',
                verified_name: 'Dr. Sharma Clinic',
                quality_rating: 'GREEN',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const numbers = await getWabaPhoneNumbers({
        wabaId: 'waba-12345',
        accessToken: 'VALID_TOKEN',
      });

      expect(numbers.length).toBe(1);
      expect(numbers[0].id).toBe('phone-100200');
      expect(numbers[0].display_phone_number).toBe('+91 98765 43210');
      expect(numbers[0].verified_name).toBe('Dr. Sharma Clinic');
    });
  });

  describe('4. getPhoneNumberDetails', () => {
    it('fetches metadata for a single phone number ID', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'phone-100200',
            display_phone_number: '+1 555 123 4567',
            verified_name: 'Helpa Health',
            quality_rating: 'GREEN',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const info = await getPhoneNumberDetails({
        phoneNumberId: 'phone-100200',
        accessToken: 'VALID_TOKEN',
      });

      expect(info.id).toBe('phone-100200');
      expect(info.verified_name).toBe('Helpa Health');
      expect(info.display_phone_number).toBe('+1 555 123 4567');
    });
  });

  describe('5. subscribeWabaWebhook', () => {
    it('subscribes WABA to webhooks successfully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const success = await subscribeWabaWebhook({
        wabaId: 'waba-12345',
        accessToken: 'VALID_TOKEN',
      });

      expect(success).toBe(true);
    });
  });

  describe('6. checkConnectionHealth', () => {
    it('reports healthy when token and phone number are verified', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (url: string | URL | Request) => {
          const urlStr = typeof url === 'string' ? url : url.toString();
          if (urlStr.includes('phone_numbers')) {
            return Promise.resolve(
              new Response(JSON.stringify({ data: [{ id: 'phone-100' }] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            );
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'phone-100',
                display_phone_number: '+91 99999 88888',
                verified_name: 'Apex Health',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
      );

      const health = await checkConnectionHealth({
        phoneNumberId: 'phone-100',
        wabaId: 'waba-999',
        accessToken: 'VALID_TOKEN',
      });

      expect(health.isHealthy).toBe(true);
      expect(health.tokenValid).toBe(true);
      expect(health.phoneAccessible).toBe(true);
      expect(health.phoneInfo?.verified_name).toBe('Apex Health');
    });

    it('reports unhealthy when token is expired (error 190)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: 'Error validating access token: Session has expired.',
              type: 'OAuthException',
              code: 190,
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const health = await checkConnectionHealth({
        phoneNumberId: 'phone-100',
        accessToken: 'EXPIRED_TOKEN',
      });

      expect(health.isHealthy).toBe(false);
      expect(health.tokenValid).toBe(false);
      expect(health.error).toContain('Meta access token has expired');
    });
  });
});
