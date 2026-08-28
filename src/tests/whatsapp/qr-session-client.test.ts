import { describe, expect, it } from 'vitest';
import {
  qrSessionUnavailableMessage,
  readQrSessionResponse,
} from '@/core/whatsapp/qr-session-client';

describe('readQrSessionResponse', () => {
  it('does not surface HTML parse errors from a document response', async () => {
    const res = new Response(
      '<!DOCTYPE html><html><body>Not found</body></html>',
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
    await expect(readQrSessionResponse(res)).rejects.toThrow(
      qrSessionUnavailableMessage(404)
    );
    expect(qrSessionUnavailableMessage(404)).not.toMatch(/Unexpected token/);
  });

  it('parses JSON session payloads', async () => {
    const res = new Response(
      JSON.stringify({
        success: true,
        status: 'waiting_for_scan',
        qr_code: '2@pairing',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    const payload = await readQrSessionResponse(res);
    expect(payload.status).toBe('waiting_for_scan');
    expect(payload.qr_code).toBe('2@pairing');
  });
});
