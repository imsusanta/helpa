/**
 * Helpa Core Platform — Unified AI Provider Architecture
 *
 * Pluggable AI provider interface supporting OpenRouter and OrcaRouter as first-class LLM providers.
 * All providers implement the standard AiProvider contract including capability reporting,
 * health checking, structured output formatting, and streaming support.
 */

import { normalizeAiError } from './errors';
import type {
  AiProviderCapabilities,
  AiProviderHealth,
  AiProviderName,
} from './types';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  apiKey?: string;
  responseFormat?: { type: 'json_object' | 'text' };
  feature?: string;
}

export interface AiCompletionResult {
  content: string;
  model: string;
  provider: AiProviderName;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

export interface AiProvider {
  name: AiProviderName;
  capabilities: AiProviderCapabilities;
  generateCompletion(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<AiCompletionResult>;
  generateStream?(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<ReadableStream<string>>;
  healthCheck(apiKey?: string, model?: string): Promise<AiProviderHealth>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. OPENROUTER PROVIDER IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export class OpenRouterProvider implements AiProvider {
  public name: AiProviderName = 'openrouter';

  public capabilities: AiProviderCapabilities = {
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
  };

  public async generateCompletion(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<AiCompletionResult> {
    const startTime = Date.now();
    const apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw normalizeAiError(
        'OpenRouter API key is missing. Please configure OPENROUTER_API_KEY.',
        this.name
      );
    }

    const model = options?.model || 'google/gemini-2.5-flash';
    const temperature = options?.temperature ?? 0.3;
    const maxTokens = options?.maxTokens ?? 1000;
    const timeoutMs = options?.timeoutMs ?? 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json',
            'HTTP-Referer':
              process.env.NEXT_PUBLIC_APP_URL || 'https://helpa.studio',
            'X-Title': 'Helpa AI Engine',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            provider: {
              require_parameters: true,
              sort: 'latency',
              allow_fallbacks: true,
            },
            ...(options?.responseFormat
              ? { response_format: options.responseFormat }
              : {}),
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenRouter API error (HTTP ${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        content,
        model: data.model || model,
        provider: this.name,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      throw normalizeAiError(err, this.name);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async healthCheck(
    apiKey?: string,
    model?: string
  ): Promise<AiProviderHealth> {
    const startTime = Date.now();
    const keyToUse = apiKey || process.env.OPENROUTER_API_KEY;
    if (!keyToUse || !keyToUse.trim()) {
      return {
        provider: this.name,
        status: 'unavailable',
        message: 'OpenRouter API Key not configured',
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const res = await this.generateCompletion(
        [{ role: 'user', content: 'Ping test. Reply with "pong".' }],
        {
          apiKey: keyToUse,
          model: model || 'google/gemini-2.5-flash',
          maxTokens: 10,
          timeoutMs: 10000,
        }
      );
      return {
        provider: this.name,
        status: 'healthy',
        latencyMs: Date.now() - startTime,
        message: `Connected successfully (${res.model})`,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        provider: this.name,
        status: 'error',
        latencyMs: Date.now() - startTime,
        message: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. ORCAROUTER PROVIDER IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export class OrcaRouterProvider implements AiProvider {
  public name: AiProviderName = 'orcarouter';

  public capabilities: AiProviderCapabilities = {
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
  };

  private readonly baseUrl = 'https://api.orcarouter.ai/v1';

  public async generateCompletion(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<AiCompletionResult> {
    const startTime = Date.now();
    const apiKey = options?.apiKey || process.env.ORCAROUTER_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw normalizeAiError(
        'OrcaRouter API key is missing. Please configure ORCAROUTER_API_KEY.',
        this.name
      );
    }

    // Support orcarouter/auto as valid OrcaRouter model choice
    const model = options?.model || 'orcarouter/auto';
    const temperature = options?.temperature ?? 0.3;
    const maxTokens = options?.maxTokens ?? 1000;
    const timeoutMs = options?.timeoutMs ?? 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            process.env.NEXT_PUBLIC_APP_URL || 'https://helpa.studio',
          'X-Title': 'Helpa AI Engine (OrcaRouter)',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(options?.responseFormat
            ? { response_format: options.responseFormat }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OrcaRouter API error (HTTP ${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        content,
        model: data.model || model,
        provider: this.name,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      throw normalizeAiError(err, this.name);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async healthCheck(
    apiKey?: string,
    model?: string
  ): Promise<AiProviderHealth> {
    const startTime = Date.now();
    const keyToUse = apiKey || process.env.ORCAROUTER_API_KEY;
    if (!keyToUse || !keyToUse.trim()) {
      return {
        provider: this.name,
        status: 'unavailable',
        message: 'OrcaRouter API Key not configured',
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const res = await this.generateCompletion(
        [{ role: 'user', content: 'Ping test. Reply with "pong".' }],
        {
          apiKey: keyToUse,
          model: model || 'orcarouter/auto',
          maxTokens: 10,
          timeoutMs: 10000,
        }
      );
      return {
        provider: this.name,
        status: 'healthy',
        latencyMs: Date.now() - startTime,
        message: `Connected successfully (${res.model})`,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        provider: this.name,
        status: 'error',
        latencyMs: Date.now() - startTime,
        message: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. PROVIDER REGISTRY & INSTANCES
// ═══════════════════════════════════════════════════════════════════════════

export { OpenRouterProvider as OpenRouterAiProvider };

const openRouterProvider = new OpenRouterProvider();
const orcaRouterProvider = new OrcaRouterProvider();

export function getProviderInstance(name: AiProviderName): AiProvider {
  if (
    defaultProvider &&
    defaultProvider !== openRouterProvider &&
    defaultProvider !== orcaRouterProvider
  ) {
    return defaultProvider;
  }
  if (name === 'orcarouter') {
    return orcaRouterProvider;
  }
  return openRouterProvider;
}

let defaultProvider: AiProvider = openRouterProvider;

export function getAiProvider(): AiProvider {
  return defaultProvider;
}

export function setAiProvider(provider: AiProvider): void {
  defaultProvider = provider;
}
