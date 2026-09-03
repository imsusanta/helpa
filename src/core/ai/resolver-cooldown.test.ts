import { describe, expect, it } from 'vitest';
import { HelpaAiError } from './errors';
import { providerCooldownMsForError } from './resolver';

describe('providerCooldownMsForError', () => {
  it('does not park a provider after a single timeout', () => {
    expect(
      providerCooldownMsForError(
        new HelpaAiError('aborted', 'AI_TIMEOUT', 'cloudflare')
      )
    ).toBe(0);
  });

  it('keeps a long cooldown for rate limits and credits', () => {
    expect(
      providerCooldownMsForError(
        new HelpaAiError('402', 'AI_RATE_LIMITED', 'openrouter', 402)
      )
    ).toBe(30 * 60 * 1000);
  });

  it('uses a transient cooldown for other provider outages', () => {
    expect(
      providerCooldownMsForError(
        new HelpaAiError('down', 'AI_PROVIDER_UNAVAILABLE', 'orcarouter', 503)
      )
    ).toBe(10 * 60 * 1000);
  });
});
