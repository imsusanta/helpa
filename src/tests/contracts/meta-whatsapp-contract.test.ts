import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exchangeAuthorizationCode,
  getPhoneNumberDetails,
  subscribeWabaWebhook,
} from '@/lib/whatsapp/meta-service';
import { sendTextMessage } from '@/lib/whatsapp/meta-api';

describe('Meta WhatsApp Graph API v21.0 Boundary Contract Tests', () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch') as any;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('adheres to Meta OAuth token exchange response contract', async () => {
    const mockTokenResponse = {
      access_token: 'EAABwz...valid_token',
      token_type: 'bearer',
      expires_in: 5184000,
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTokenResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await exchangeAuthorizationCode({
      code: 'AQD...auth_code',
      appId: '1234567890',
      appSecret: 'test_secret',
    });

    expect(result).toEqual({
      accessToken: 'EAABwz...valid_token',
      tokenType: 'bearer',
      expiresIn: 5184000,
    });
  });

  it('adheres to Meta Phone Number Details response contract', async () => {
    const mockPhoneResponse = {
      verified_name: 'City Health Clinic',
      display_phone_number: '+1 555-0199',
      id: 'phone_12345',
      quality_rating: 'GREEN',
      code_verification_status: 'VERIFIED',
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockPhoneResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await getPhoneNumberDetails({
      phoneNumberId: 'phone_12345',
      accessToken: 'EAABwz...valid_token',
    });

    expect(result.id).toBe('phone_12345');
    expect(result.verified_name).toBe('City Health Clinic');
    expect(result.display_phone_number).toBe('+1 555-0199');
    expect(result.quality_rating).toBe('GREEN');
  });

  it('adheres to Meta Subscribed Apps webhook contract', async () => {
    const mockSubscribedResponse = {
      success: true,
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockSubscribedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await subscribeWabaWebhook({
      wabaId: 'waba_98765',
      accessToken: 'EAABwz...valid_token',
    });

    expect(result).toBe(true);
  });

  it('adheres to Meta Message Send (Text) response contract', async () => {
    const mockSendResponse = {
      messaging_product: 'whatsapp',
      contacts: [
        {
          input: '+919876543210',
          wa_id: '919876543210',
        },
      ],
      messages: [
        {
          id: 'wamid.HBgLMTIzNDU2Nzg5MA==',
        },
      ],
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockSendResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await sendTextMessage({
      phoneNumberId: 'phone_12345',
      to: '+919876543210',
      text: 'Hello, your appointment is confirmed.',
      accessToken: 'EAABwz...valid_token',
    });

    expect(result.messageId).toBe('wamid.HBgLMTIzNDU2Nzg5MA==');
  });

  it('adheres to Meta Error Contract and parses error responses correctly', async () => {
    const mockErrorResponse = {
      error: {
        message: 'Message outside of 24h customer service window.',
        type: 'OAuthException',
        code: 131047,
        fbtrace_id: 'A1B2C3D4E5F6',
      },
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockErrorResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      sendTextMessage({
        phoneNumberId: 'phone_12345',
        to: '+919876543210',
        text: 'Non-template follow up',
        accessToken: 'EAABwz...valid_token',
      })
    ).rejects.toThrow('Message outside of 24h customer service window.');
  });
});
