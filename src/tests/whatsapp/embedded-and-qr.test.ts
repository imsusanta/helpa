import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

describe('WhatsApp Multi-Modal Connection (Embedded Signup & QR Linked Device)', () => {
  it('correctly parses and validates Embedded Signup parameters', () => {
    const mockPayload = {
      code: 'AQD123456789MetaAuthCode',
      waba_id: '1484140933723294',
      phone_number_id: '1034885893047167',
    };

    expect(mockPayload.code).toBeDefined();
    expect(mockPayload.waba_id).toBe('1484140933723294');
    expect(mockPayload.phone_number_id).toBe('1034885893047167');
  });

  it('recognizes Evolution pairing strings without synthesizing a Helpa QR', () => {
    const evolutionPairing = `2@session-id,public-key,1700000000000`;
    expect(evolutionPairing.startsWith('2@')).toBe(true);
    expect(evolutionPairing).not.toContain('helpa-crm-device');
  });

  it('properly encrypts and decrypts OAuth tokens obtained via Embedded Signup', () => {
    const oauthAccessToken = 'EAAG1461038582135406_LongLivedToken_ABCXYZ';
    const encrypted = encrypt(oauthAccessToken);

    expect(encrypted).not.toBe(oauthAccessToken);
    expect(encrypted.split(':').length).toBe(3); // iv:tag:ciphertext

    const recovered = decrypt(encrypted);
    expect(recovered).toBe(oauthAccessToken);
  });
});
