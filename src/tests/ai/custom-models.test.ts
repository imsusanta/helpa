import { describe, it, expect } from 'vitest';
import { resolveAccountAiConfig } from '@/core/ai/resolver';

describe('Custom AI Model Selection & Resolution (#490)', () => {

  it('correctly resolves custom OpenRouter model override', async () => {
    const config = await resolveAccountAiConfig(undefined, {
      primaryProvider: 'openrouter',
      customModel: 'deepseek/deepseek-r1',
    });

    expect(config.primary.provider.name).toBe('openrouter');
    expect(config.primary.model).toBe('deepseek/deepseek-r1');
  });

  it('correctly resolves custom OrcaRouter model override', async () => {
    const config = await resolveAccountAiConfig(undefined, {
      primaryProvider: 'orcarouter',
      customModel: 'anthropic/claude-3-7-sonnet',
    });

    expect(config.primary.provider.name).toBe('orcarouter');
    expect(config.primary.model).toBe('anthropic/claude-3-7-sonnet');
  });

  it('maintains safe fallback model if custom model is not provided', async () => {
    const config = await resolveAccountAiConfig(undefined, {
      primaryProvider: 'openrouter',
    });

    expect(config.primary.provider.name).toBe('openrouter');
    expect(config.primary.model).toBe('google/gemini-2.5-flash');
  });
});
