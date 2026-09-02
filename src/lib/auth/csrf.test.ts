import { describe, expect, it } from 'vitest';
import { validateCsrfHeader } from './csrf';

function requestWith(headers: Record<string, string>): Request {
  return new Request('https://helpa.studio/api/example', { headers });
}

describe('validateCsrfHeader', () => {
  it('allows calls that already carry an Authorization header', () => {
    expect(
      validateCsrfHeader(requestWith({ authorization: 'Bearer token' }))
    ).toBe(true);
  });

  it('allows Appwrite API-key authenticated calls', () => {
    expect(
      validateCsrfHeader(requestWith({ 'x-appwrite-key': 'server-key' }))
    ).toBe(true);
  });

  it.each([
    'x-hub-signature-256',
    'x-waha-signature',
    'x-twilio-signature',
    'calendly-webhook-signature',
    'x-elevenlabs-signature',
  ])('allows webhook-signed requests via %s', (header) => {
    expect(validateCsrfHeader(requestWith({ [header]: 'sig' }))).toBe(true);
  });

  it('rejects cookie-authenticated browser requests with no Origin or Referer', () => {
    expect(validateCsrfHeader(requestWith({ host: 'helpa.studio' }))).toBe(
      false
    );
  });

  it('allows a matching Origin against Host', () => {
    expect(
      validateCsrfHeader(
        requestWith({
          origin: 'https://helpa.studio',
          host: 'helpa.studio',
        })
      )
    ).toBe(true);
  });

  it('strips a port from Host before comparing', () => {
    expect(
      validateCsrfHeader(
        requestWith({
          origin: 'https://helpa.studio',
          host: 'helpa.studio:443',
        })
      )
    ).toBe(true);
  });

  it('falls back to x-forwarded-host when Host is missing', () => {
    expect(
      validateCsrfHeader(
        requestWith({
          origin: 'https://helpa.studio',
          'x-forwarded-host': 'helpa.studio',
        })
      )
    ).toBe(true);
  });

  it('allows localhost and 127.0.0.1 origins even when Host differs', () => {
    expect(
      validateCsrfHeader(
        requestWith({
          origin: 'http://localhost:3000',
          host: 'helpa.studio',
        })
      )
    ).toBe(true);
    expect(
      validateCsrfHeader(
        requestWith({
          origin: 'http://127.0.0.1:3000',
          host: 'helpa.studio',
        })
      )
    ).toBe(true);
  });

  it('uses Referer when Origin is absent', () => {
    expect(
      validateCsrfHeader(
        requestWith({
          referer: 'https://helpa.studio/inbox',
          host: 'helpa.studio',
        })
      )
    ).toBe(true);
  });

  it('rejects a cross-origin browser request', () => {
    expect(
      validateCsrfHeader(
        requestWith({
          origin: 'https://evil.example',
          host: 'helpa.studio',
        })
      )
    ).toBe(false);
  });

  it('allows a valid Origin when neither Host header is present', () => {
    expect(
      validateCsrfHeader(requestWith({ origin: 'https://helpa.studio' }))
    ).toBe(true);
  });

  it('rejects an unparseable Origin/Referer value', () => {
    expect(
      validateCsrfHeader(
        requestWith({
          origin: 'not a url',
          host: 'helpa.studio',
        })
      )
    ).toBe(false);
  });
});
