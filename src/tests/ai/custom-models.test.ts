import { describe, it, expect } from 'vitest';
import { resolveAccountAiConfig } from '@/core/ai/resolver';
import { sanitizeModelIdentifier, validateAiModelId } from '@/core/ai/validation';

describe('Custom AI Model Selection, Validation & Sanitization (#490, #202)', () => {

  describe('1. Model Identifier Sanitization', () => {
    it('strips quotes, backticks, spaces, and leading/trailing slashes', () => {
      expect(sanitizeModelIdentifier('"deepseek/deepseek-r1"')).toBe('deepseek/deepseek-r1');
      expect(sanitizeModelIdentifier("'google/gemini-2.5-pro'")).toBe('google/gemini-2.5-pro');
      expect(sanitizeModelIdentifier('`anthropic/claude-3.5-sonnet`')).toBe('anthropic/claude-3.5-sonnet');
      expect(sanitizeModelIdentifier('  /meta-llama/llama-3.3-70b-instruct/  ')).toBe('meta-llama/llama-3.3-70b-instruct');
      expect(sanitizeModelIdentifier('deepseek / deepseek - r1')).toBe('deepseek/deepseek-r1');
      expect(sanitizeModelIdentifier('')).toBe('');
    });
  });

  describe('2. OpenRouter Model Validation', () => {
    it('accepts valid organization/model-name formats', () => {
      const validModels = [
        'deepseek/deepseek-r1',
        'google/gemini-2.5-pro',
        'anthropic/claude-3.5-sonnet',
        'meta-llama/llama-3.3-70b-instruct',
        'qwen/qwen-2.5-72b-instruct:free',
        'mistralai/mistral-large-2407',
        'cohere/command-r-plus',
      ];

      validModels.forEach((m) => {
        const res = validateAiModelId(m, 'openrouter');
        expect(res.valid).toBe(true);
        expect(res.normalizedId).toBe(m);
        expect(res.error).toBeUndefined();
      });
    });

    it('rejects invalid OpenRouter formats missing organization', () => {
      const invalid = ['gemini-2.5-flash', 'claude-3.5-sonnet', '', '  ', 'invalid$$/model'];
      invalid.forEach((m) => {
        const res = validateAiModelId(m, 'openrouter');
        expect(res.valid).toBe(false);
        expect(res.error).toBeDefined();
      });
    });
  });

  describe('3. OrcaRouter Model Validation', () => {
    it('accepts valid OrcaRouter identifiers', () => {
      const validModels = [
        'orcarouter/auto',
        'openai/gpt-4o-mini',
        'anthropic/claude-3-5-sonnet',
        'deepseek/deepseek-chat',
        'meta-llama/llama-3.3-70b',
      ];

      validModels.forEach((m) => {
        const res = validateAiModelId(m, 'orcarouter');
        expect(res.valid).toBe(true);
        expect(res.normalizedId).toBe(m);
      });
    });

    it('rejects empty or illegal OrcaRouter identifiers', () => {
      expect(validateAiModelId('', 'orcarouter').valid).toBe(false);
      expect(validateAiModelId('ab', 'orcarouter').valid).toBe(false); // too short
    });
  });

  describe('4. Custom Model Resolution with Sanitization', () => {
    it('correctly sanitizes and resolves custom OpenRouter model override', async () => {
      const config = await resolveAccountAiConfig(undefined, {
        primaryProvider: 'openrouter',
        customModel: '  "deepseek/deepseek-r1"  ',
      });

      expect(config.primary.provider.name).toBe('openrouter');
      expect(config.primary.model).toBe('deepseek/deepseek-r1');
    });

    it('correctly sanitizes and resolves custom OrcaRouter model override', async () => {
      const config = await resolveAccountAiConfig(undefined, {
        primaryProvider: 'orcarouter',
        customModel: "'anthropic/claude-3-7-sonnet'",
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
});
