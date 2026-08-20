import { describe, it, expect, vi } from 'vitest';
import {
  OpenRouterProvider,
  OrcaRouterProvider,
  CloudflareAiProvider,
  getProviderInstance,
} from '@/core/ai/provider';
import {
  isRetryableAiError,
  normalizeAiError,
  HelpaAiError,
} from '@/core/ai/errors';
import { executeAiCompletionWithFallback } from '@/core/ai/resolver';
import { calculateEstimatedCost } from '@/core/ai/usage-tracker';

describe('AI Provider Architecture & OrcaRouter Integration', () => {
  describe('1. Provider Abstraction & Capabilities', () => {
    it('should instantiate OpenRouterProvider with proper capabilities', () => {
      const provider = new OpenRouterProvider();
      expect(provider.name).toBe('openrouter');
      expect(provider.capabilities.supportsStreaming).toBe(true);
      expect(provider.capabilities.supportsToolCalling).toBe(true);
      expect(provider.capabilities.supportsStructuredOutput).toBe(true);
    });

    it('should instantiate OrcaRouterProvider with proper capabilities and auto model support', () => {
      const provider = new OrcaRouterProvider();
      expect(provider.name).toBe('orcarouter');
      expect(provider.capabilities.supportsStreaming).toBe(true);
      expect(provider.capabilities.supportsToolCalling).toBe(true);
      expect(provider.capabilities.supportsStructuredOutput).toBe(true);
    });

    it('should instantiate CloudflareAiProvider with proper capabilities', () => {
      const provider = new CloudflareAiProvider();
      expect(provider.name).toBe('cloudflare');
      expect(provider.capabilities.supportsStreaming).toBe(true);
      expect(provider.capabilities.supportsStructuredOutput).toBe(true);
    });

    it('should retrieve correct provider instance from registry', () => {
      const openrouter = getProviderInstance('openrouter');
      const orcarouter = getProviderInstance('orcarouter');
      const cloudflare = getProviderInstance('cloudflare');
      expect(openrouter).toBeInstanceOf(OpenRouterProvider);
      expect(orcarouter).toBeInstanceOf(OrcaRouterProvider);
      expect(cloudflare).toBeInstanceOf(CloudflareAiProvider);
    });
  });

  describe('2. Error Normalization & Retryable Classification', () => {
    it('should correctly classify 429 rate limit errors as retryable', () => {
      const err = new HelpaAiError(
        'Rate limit exceeded',
        'AI_RATE_LIMITED',
        'orcarouter',
        429
      );
      expect(isRetryableAiError(err)).toBe(true);
    });

    it('should correctly classify 500/503 server errors as retryable', () => {
      const err = new HelpaAiError(
        'Server error',
        'AI_PROVIDER_UNAVAILABLE',
        'orcarouter',
        503
      );
      expect(isRetryableAiError(err)).toBe(true);
    });

    it('should NOT classify 401 auth or 400 bad request errors as retryable', () => {
      const authErr = new HelpaAiError(
        'Invalid API key',
        'AI_AUTHENTICATION_FAILED',
        'orcarouter',
        401
      );
      const reqErr = new HelpaAiError(
        'Invalid request parameter',
        'AI_INVALID_REQUEST',
        'orcarouter',
        400
      );

      expect(isRetryableAiError(authErr)).toBe(false);
      expect(isRetryableAiError(reqErr)).toBe(false);
    });

    it('should normalize raw fetch error strings to HelpaAiError', () => {
      const raw = new Error('OpenRouter API error (HTTP 401): Unauthorized');
      const norm = normalizeAiError(raw, 'openrouter');
      expect(norm).toBeInstanceOf(HelpaAiError);
      expect(norm.code).toBe('AI_AUTHENTICATION_FAILED');
      expect(norm.provider).toBe('openrouter');
    });
  });

  describe('3. Cost Tracker', () => {
    it('should calculate estimated cost for known models', () => {
      const costGemini = calculateEstimatedCost(
        'openrouter',
        'google/gemini-2.5-flash',
        1000,
        500
      );
      expect(costGemini).toBeGreaterThan(0);

      const costOrcaAuto = calculateEstimatedCost(
        'orcarouter',
        'orcarouter/auto',
        1000,
        500
      );
      expect(costOrcaAuto).toBeGreaterThan(0);
    });

    it('should return undefined for unknown models without inventing arbitrary cost', () => {
      const costUnknown = calculateEstimatedCost(
        'openrouter',
        'unknown-model-xyz',
        1000,
        500
      );
      expect(costUnknown).toBeUndefined();
    });
  });

  describe('4. Provider Health Checks', () => {
    it('should return unavailable status when Cloudflare credentials are missing', async () => {
      const provider = new CloudflareAiProvider();
      const origToken = process.env.CLOUDFLARE_API_TOKEN;
      const origAcc = process.env.CLOUDFLARE_ACCOUNT_ID;
      delete process.env.CLOUDFLARE_API_TOKEN;
      delete process.env.CLOUDFLARE_ACCOUNT_ID;

      const health = await provider.healthCheck('');
      expect(health.status).toBe('unavailable');
      expect(health.provider).toBe('cloudflare');

      if (origToken) process.env.CLOUDFLARE_API_TOKEN = origToken;
      if (origAcc) process.env.CLOUDFLARE_ACCOUNT_ID = origAcc;
    });
  });

  describe('5. Provider Selection & Fallback Routing', () => {
    it('should execute Cloudflare provider when selected as primary', async () => {
      const cloudflare = getProviderInstance('cloudflare');
      const spy = vi
        .spyOn(cloudflare, 'generateCompletion')
        .mockResolvedValueOnce({
          content: 'Response from Cloudflare Workers AI',
          model: '@cf/meta/llama-3.1-8b-instruct',
          provider: 'cloudflare',
          promptTokens: 8,
          completionTokens: 4,
          totalTokens: 12,
          latencyMs: 90,
        });

      const res = await executeAiCompletionWithFallback({
        messages: [{ role: 'user', content: 'Test prompt' }],
        resolutionParams: {
          primaryProvider: 'cloudflare',
          fallbackProvider: 'openrouter',
        },
      });

      expect(res.content).toBe('Response from Cloudflare Workers AI');
      expect(res.provider).toBe('cloudflare');
      spy.mockRestore();
    });

    it('should execute primary provider when request succeeds', async () => {
      const openrouter = getProviderInstance('openrouter');
      const spy = vi
        .spyOn(openrouter, 'generateCompletion')
        .mockResolvedValueOnce({
          content: 'Response from primary provider',
          model: 'google/gemini-2.5-flash',
          provider: 'openrouter',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          latencyMs: 100,
        });

      const res = await executeAiCompletionWithFallback({
        messages: [{ role: 'user', content: 'Test prompt' }],
        resolutionParams: {
          primaryProvider: 'openrouter',
          fallbackProvider: 'orcarouter',
        },
      });

      expect(res.content).toBe('Response from primary provider');
      expect(res.provider).toBe('openrouter');
      spy.mockRestore();
    });

    it('should trigger fallback provider when primary fails with retryable error', async () => {
      const openrouter = getProviderInstance('openrouter');
      const orcarouter = getProviderInstance('orcarouter');

      const spyPrimary = vi
        .spyOn(openrouter, 'generateCompletion')
        .mockRejectedValue(
          new HelpaAiError(
            '503 Service Unavailable',
            'AI_PROVIDER_UNAVAILABLE',
            'openrouter',
            503
          )
        );

      const spyFallback = vi
        .spyOn(orcarouter, 'generateCompletion')
        .mockResolvedValueOnce({
          content: 'Fallback response from OrcaRouter',
          model: 'orcarouter/auto',
          provider: 'orcarouter',
          promptTokens: 12,
          completionTokens: 6,
          totalTokens: 18,
          latencyMs: 120,
        });

      const res = await executeAiCompletionWithFallback({
        messages: [{ role: 'user', content: 'Test prompt' }],
        resolutionParams: {
          primaryProvider: 'openrouter',
          fallbackProvider: 'orcarouter',
        },
      });

      expect(res.content).toBe('Fallback response from OrcaRouter');
      expect(res.provider).toBe('orcarouter');

      spyPrimary.mockRestore();
      spyFallback.mockRestore();
    });

    it('should NOT trigger fallback when primary fails with non-retryable 401 auth error', async () => {
      const openrouter = getProviderInstance('openrouter');
      const orcarouter = getProviderInstance('orcarouter');

      const spyPrimary = vi
        .spyOn(openrouter, 'generateCompletion')
        .mockRejectedValue(
          new HelpaAiError(
            '401 Unauthorized API Key',
            'AI_AUTHENTICATION_FAILED',
            'openrouter',
            401
          )
        );

      const spyFallback = vi.spyOn(orcarouter, 'generateCompletion');

      await expect(
        executeAiCompletionWithFallback({
          messages: [{ role: 'user', content: 'Test prompt' }],
          resolutionParams: {
            primaryProvider: 'openrouter',
            fallbackProvider: 'orcarouter',
          },
        })
      ).rejects.toThrow('401 Unauthorized API Key');

      expect(spyFallback).not.toHaveBeenCalled();

      spyPrimary.mockRestore();
      spyFallback.mockRestore();
    });
  });
});
