import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAccountAiConfig } from '@/core/ai/resolver';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Centralized Super Admin AI Routing & Feature-Level Model Assignment', () => {
  it('resolves centralized primary provider when set to OrcaRouter', async () => {
    vi.stubEnv('ORCAROUTER_API_KEY', 'test-orcarouter-key');
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');

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
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');

    const config = await resolveAccountAiConfig(undefined, {
      primaryProvider: 'openrouter',
      fallbackProvider: 'none',
    });

    expect(config.primary.provider.name).toBe('openrouter');
    expect(config.primary.model).toBe('google/gemini-2.5-flash');
    expect(config.fallback).toBeUndefined();
  });

  it('resolves custom model assignment for specialized feature routing', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');

    const config = await resolveAccountAiConfig(undefined, {
      primaryProvider: 'openrouter',
      customModel: 'anthropic/claude-3.5-sonnet',
      feature: 'AI_AGENT',
    });

    expect(config.primary.provider.name).toBe('openrouter');
    expect(config.primary.model).toBe('anthropic/claude-3.5-sonnet');
  });
});
