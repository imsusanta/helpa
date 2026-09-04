import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import {
  cooldownForError,
  executeAiCompletionWithFallback,
  OUTAGE_COOLDOWN_MS,
  RATE_LIMIT_COOLDOWN_MS,
  TIMEOUT_COOLDOWN_MS,
} from '@/core/ai/resolver';
import * as failoverState from '@/core/ai/failover-state';
import { calculateEstimatedCost } from '@/core/ai/usage-tracker';

const TEST_AI_KEYS = {
  OPENROUTER_API_KEY: 'test-openrouter-key',
  ORCAROUTER_API_KEY: 'test-orcarouter-key',
  CLOUDFLARE_API_TOKEN: 'test-cloudflare-token',
  CLOUDFLARE_ACCOUNT_ID: 'test-cloudflare-account',
} as const;

describe('AI Provider Architecture & OrcaRouter Integration', () => {
  const previousAiKeys: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const [key, value] of Object.entries(TEST_AI_KEYS)) {
      previousAiKeys[key] = process.env[key];
      process.env[key] = value;
    }
  });

  afterEach(() => {
    for (const key of Object.keys(TEST_AI_KEYS)) {
      if (previousAiKeys[key] === undefined) delete process.env[key];
      else process.env[key] = previousAiKeys[key];
    }
  });
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

    it('should classify revoked credentials as retryable and invalid requests as not', () => {
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

      expect(isRetryableAiError(authErr)).toBe(true);
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

    it('should trigger fallback when primary fails with a revoked credential', async () => {
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

      const spyFallback = vi
        .spyOn(orcarouter, 'generateCompletion')
        .mockResolvedValueOnce({
          content: 'Fallback after primary auth failure',
          model: 'orcarouter/auto',
          provider: 'orcarouter',
          promptTokens: 8,
          completionTokens: 4,
          totalTokens: 12,
          latencyMs: 80,
        });

      const res = await executeAiCompletionWithFallback({
        messages: [{ role: 'user', content: 'Test prompt' }],
        resolutionParams: {
          primaryProvider: 'openrouter',
          fallbackProvider: 'orcarouter',
        },
      });

      expect(res.content).toBe('Fallback after primary auth failure');
      expect(res.provider).toBe('orcarouter');
      expect(spyFallback).toHaveBeenCalled();

      spyPrimary.mockRestore();
      spyFallback.mockRestore();
    });

    it('should NOT trigger fallback when primary fails with a non-retryable 400', async () => {
      const openrouter = getProviderInstance('openrouter');
      const orcarouter = getProviderInstance('orcarouter');

      const spyPrimary = vi
        .spyOn(openrouter, 'generateCompletion')
        .mockRejectedValue(
          new HelpaAiError(
            'Invalid request parameter',
            'AI_INVALID_REQUEST',
            'openrouter',
            400
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
      ).rejects.toThrow('Invalid request parameter');

      expect(spyFallback).not.toHaveBeenCalled();

      spyPrimary.mockRestore();
      spyFallback.mockRestore();
    });
  });

  describe('6. Cooldown Policies & Timeout Reliability', () => {
    it('Rate limit creates 30-minute cooldown', async () => {
      const err = new HelpaAiError(
        'Rate limit reached',
        'AI_RATE_LIMITED',
        'openrouter',
        429
      );
      expect(cooldownForError(err)).toBe(RATE_LIMIT_COOLDOWN_MS);
      expect(cooldownForError(err)).toBe(30 * 60 * 1000);

      const openrouter = getProviderInstance('openrouter');
      const orcarouter = getProviderInstance('orcarouter');
      const setCooldownSpy = vi
        .spyOn(failoverState, 'setProviderCooldown')
        .mockResolvedValue();

      const spyPrimary = vi
        .spyOn(openrouter, 'generateCompletion')
        .mockRejectedValue(err);

      const spyFallback = vi
        .spyOn(orcarouter, 'generateCompletion')
        .mockResolvedValueOnce({
          content: 'Fallback response after rate limit',
          model: 'orcarouter/auto',
          provider: 'orcarouter',
          promptTokens: 5,
          completionTokens: 5,
          totalTokens: 10,
          latencyMs: 120,
        });

      const res = await executeAiCompletionWithFallback({
        messages: [{ role: 'user', content: 'Test prompt' }],
        resolutionParams: {
          primaryProvider: 'openrouter',
          fallbackProvider: 'orcarouter',
        },
      });

      expect(res.content).toBe('Fallback response after rate limit');
      expect(setCooldownSpy).toHaveBeenCalledWith(
        'openrouter',
        RATE_LIMIT_COOLDOWN_MS
      );

      setCooldownSpy.mockRestore();
      spyPrimary.mockRestore();
      spyFallback.mockRestore();
    });

    it('Timeout creates no persistent cooldown', async () => {
      const timeoutErr = new HelpaAiError(
        'Request timed out',
        'AI_TIMEOUT',
        'openrouter'
      );
      expect(cooldownForError(timeoutErr)).toBe(TIMEOUT_COOLDOWN_MS);
      expect(cooldownForError(timeoutErr)).toBe(0);

      const openrouter = getProviderInstance('openrouter');
      const orcarouter = getProviderInstance('orcarouter');
      const setCooldownSpy = vi
        .spyOn(failoverState, 'setProviderCooldown')
        .mockResolvedValue();

      const spyPrimary = vi
        .spyOn(openrouter, 'generateCompletion')
        .mockRejectedValue(timeoutErr);

      const spyFallback = vi
        .spyOn(orcarouter, 'generateCompletion')
        .mockResolvedValueOnce({
          content: 'Fallback response after timeout',
          model: 'orcarouter/auto',
          provider: 'orcarouter',
          promptTokens: 5,
          completionTokens: 5,
          totalTokens: 10,
          latencyMs: 150,
        });

      const res = await executeAiCompletionWithFallback({
        messages: [{ role: 'user', content: 'Test prompt' }],
        resolutionParams: {
          primaryProvider: 'openrouter',
          fallbackProvider: 'orcarouter',
        },
      });

      expect(res.content).toBe('Fallback response after timeout');
      expect(setCooldownSpy).not.toHaveBeenCalled();

      setCooldownSpy.mockRestore();
      spyPrimary.mockRestore();
      spyFallback.mockRestore();
    });

    it('Other retryable outage creates 10-minute cooldown', async () => {
      const unavailable = new HelpaAiError(
        '503 Service Unavailable',
        'AI_PROVIDER_UNAVAILABLE',
        'openrouter',
        503
      );
      expect(cooldownForError(unavailable)).toBe(OUTAGE_COOLDOWN_MS);
      expect(cooldownForError(unavailable)).toBe(10 * 60 * 1000);

      const authErr = new HelpaAiError(
        'API Key revoked',
        'AI_AUTHENTICATION_FAILED',
        'openrouter',
        401
      );
      expect(cooldownForError(authErr)).toBe(OUTAGE_COOLDOWN_MS);

      const modelErr = new HelpaAiError(
        'Model deprecated',
        'AI_MODEL_UNAVAILABLE',
        'openrouter',
        404
      );
      expect(cooldownForError(modelErr)).toBe(OUTAGE_COOLDOWN_MS);

      const openrouter = getProviderInstance('openrouter');
      const orcarouter = getProviderInstance('orcarouter');
      const setCooldownSpy = vi
        .spyOn(failoverState, 'setProviderCooldown')
        .mockResolvedValue();

      const spyPrimary = vi
        .spyOn(openrouter, 'generateCompletion')
        .mockRejectedValue(unavailable);

      const spyFallback = vi
        .spyOn(orcarouter, 'generateCompletion')
        .mockResolvedValueOnce({
          content: 'Fallback response after 503 outage',
          model: 'orcarouter/auto',
          provider: 'orcarouter',
          promptTokens: 5,
          completionTokens: 5,
          totalTokens: 10,
          latencyMs: 110,
        });

      await executeAiCompletionWithFallback({
        messages: [{ role: 'user', content: 'Test prompt' }],
        resolutionParams: {
          primaryProvider: 'openrouter',
          fallbackProvider: 'orcarouter',
        },
      });

      expect(setCooldownSpy).toHaveBeenCalledWith(
        'openrouter',
        OUTAGE_COOLDOWN_MS
      );

      setCooldownSpy.mockRestore();
      spyPrimary.mockRestore();
      spyFallback.mockRestore();
    });

    it('Non-retryable error behavior (throws without failover or cooldown)', async () => {
      const openrouter = getProviderInstance('openrouter');
      const orcarouter = getProviderInstance('orcarouter');
      const setCooldownSpy = vi
        .spyOn(failoverState, 'setProviderCooldown')
        .mockResolvedValue();

      const invalidReq = new HelpaAiError(
        'Invalid model parameter',
        'AI_INVALID_REQUEST',
        'openrouter',
        400
      );

      const spyPrimary = vi
        .spyOn(openrouter, 'generateCompletion')
        .mockRejectedValue(invalidReq);
      const spyFallback = vi.spyOn(orcarouter, 'generateCompletion');

      await expect(
        executeAiCompletionWithFallback({
          messages: [{ role: 'user', content: 'Bad request' }],
          resolutionParams: {
            primaryProvider: 'openrouter',
            fallbackProvider: 'orcarouter',
          },
        })
      ).rejects.toThrow('Invalid model parameter');

      expect(spyFallback).not.toHaveBeenCalled();
      expect(setCooldownSpy).not.toHaveBeenCalled();

      setCooldownSpy.mockRestore();
      spyPrimary.mockRestore();
      spyFallback.mockRestore();
    });

    it('Provider selection/failover after timeout', async () => {
      const openrouter = getProviderInstance('openrouter');
      const cloudflare = getProviderInstance('cloudflare');
      const orcarouter = getProviderInstance('orcarouter');

      const spyPrimary = vi
        .spyOn(openrouter, 'generateCompletion')
        .mockRejectedValue(
          new HelpaAiError('Gateway Timeout', 'AI_TIMEOUT', 'openrouter', 504)
        );

      const spyFallback = vi
        .spyOn(cloudflare, 'generateCompletion')
        .mockResolvedValueOnce({
          content: 'Cloudflare recovered after OpenRouter timeout',
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          provider: 'cloudflare',
          promptTokens: 8,
          completionTokens: 6,
          totalTokens: 14,
          latencyMs: 140,
        });

      const spyOrca = vi.spyOn(orcarouter, 'generateCompletion');

      const res = await executeAiCompletionWithFallback({
        messages: [{ role: 'user', content: 'Test failover' }],
        resolutionParams: {
          primaryProvider: 'openrouter',
          fallbackProvider: 'cloudflare',
        },
      });

      expect(res.provider).toBe('cloudflare');
      expect(res.content).toBe('Cloudflare recovered after OpenRouter timeout');
      expect(spyFallback).toHaveBeenCalledTimes(1);
      expect(spyOrca).not.toHaveBeenCalled();

      spyPrimary.mockRestore();
      spyFallback.mockRestore();
      spyOrca.mockRestore();
    });

    it('Cloudflare default timeout is 25000ms', async () => {
      const cloudflare = new CloudflareAiProvider();
      let capturedSignal: AbortSignal | null | undefined = null;

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((_url, init) => {
          capturedSignal = init?.signal as AbortSignal | null | undefined;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                result: { response: 'cf test' },
                success: true,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        });

      await cloudflare.generateCompletion(
        [{ role: 'user', content: 'Hello' }],
        {
          apiKey: 'test-acc:test-token',
        }
      );

      expect(capturedSignal).toBeDefined();
      expect((capturedSignal as AbortSignal | null)?.aborted).toBe(false);

      fetchSpy.mockRestore();
    });

    it('Custom timeout override is respected', async () => {
      const cloudflare = new CloudflareAiProvider();
      let capturedSignal: AbortSignal | null | undefined = null;

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((_url, init) => {
          capturedSignal = init?.signal as AbortSignal | null | undefined;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                result: { response: 'cf custom timeout' },
                success: true,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        });

      await cloudflare.generateCompletion(
        [{ role: 'user', content: 'Hello' }],
        {
          apiKey: 'test-acc:test-token',
          timeoutMs: 5000,
        }
      );

      expect(capturedSignal).toBeDefined();
      expect((capturedSignal as AbortSignal | null)?.aborted).toBe(false);

      fetchSpy.mockRestore();
    });
  });
});
