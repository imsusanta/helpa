import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveAccountAiConfig } from '@/core/ai/resolver';

describe('Centralized Super Admin AI Routing & Feature-Level Model Assignment', () => {
  const previousAiKeys: Record<string, string | undefined> = {};

  beforeEach(() => {
    const keys = {
      OPENROUTER_API_KEY: 'test-openrouter-key',
      ORCAROUTER_API_KEY: 'test-orcarouter-key',
      CLOUDFLARE_API_TOKEN: 'test-cloudflare-token',
      CLOUDFLARE_ACCOUNT_ID: 'test-cloudflare-account',
    };
    for (const [key, value] of Object.entries(keys)) {
      previousAiKeys[key] = process.env[key];
      process.env[key] = value;
    }
  });

  afterEach(() => {
    for (const key of Object.keys(previousAiKeys)) {
      if (previousAiKeys[key] === undefined) delete process.env[key];
      else process.env[key] = previousAiKeys[key];
    }
  });

  it('resolves centralized primary provider when set to OrcaRouter', async () => {
    const config = await resolveAccountAiConfig(undefined, {
      primaryProvider: 'orcarouter',
      fallbackProvider: 'openrouter',
    });

    expect(config.primary.provider.name).toBe('orcarouter');
    expect(config.primary.model).toBe('orcarouter/auto');
    expect(config.fallback?.provider.name).toBe('openrouter');
    expect(config.fallback?.model).toBe('google/gemini-2.5-flash');
  });

  it('resolves centralized primary provider when set to OpenRouter', async () => {
    const config = await resolveAccountAiConfig(undefined, {
      primaryProvider: 'openrouter',
      fallbackProvider: 'none',
    });

    expect(config.primary.provider.name).toBe('openrouter');
    expect(config.primary.model).toBe('google/gemini-2.5-flash');
    expect(config.fallback?.provider.name).toBe('cloudflare');
    expect(config.fallbacks.map((entry) => entry.provider.name)).toEqual([
      'cloudflare',
      'orcarouter',
    ]);
  });

  it('resolves custom model assignment for specialized feature routing', async () => {
    const config = await resolveAccountAiConfig(undefined, {
      primaryProvider: 'openrouter',
      customModel: 'anthropic/claude-3.5-sonnet',
      feature: 'AI_AGENT',
    });

    expect(config.primary.provider.name).toBe('openrouter');
    expect(config.primary.model).toBe('anthropic/claude-3.5-sonnet');
  });
});
