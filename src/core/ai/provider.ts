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
  accountId?: string;
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
    const maxTokens = options?.maxTokens ?? 800;
    const timeoutMs = options?.timeoutMs ?? 25000;

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
              sort: 'latency',
              allow_fallbacks: true,
            },
            reasoning: {
              max_tokens: 0,
            },
            include_reasoning: false,
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
    const maxTokens = options?.maxTokens ?? 800;
    const timeoutMs = options?.timeoutMs ?? 25000;

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
          reasoning: {
            max_tokens: 0,
          },
          include_reasoning: false,
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
// 3. CLOUDFLARE WORKERS AI PROVIDER IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export class CloudflareAiProvider implements AiProvider {
  public name: AiProviderName = 'cloudflare';

  public capabilities: AiProviderCapabilities = {
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsStructuredOutput: true,
    supportsVision: false,
  };

  public async generateCompletion(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<AiCompletionResult> {
    const startTime = Date.now();

    // Resolve Account ID and API Token
    let accountId = options?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    let apiToken = options?.apiKey || process.env.CLOUDFLARE_API_TOKEN;

    // Handle combined format "account_id:api_token" if passed in apiKey
    if (apiToken && apiToken.includes(':') && !accountId) {
      const parts = apiToken.split(':');
      accountId = parts[0];
      apiToken = parts.slice(1).join(':');
    }

    if (!accountId || !accountId.trim()) {
      throw normalizeAiError(
        'Cloudflare Account ID is missing. Please configure Cloudflare Account ID.',
        this.name
      );
    }
    if (!apiToken || !apiToken.trim()) {
      throw normalizeAiError(
        'Cloudflare API Token is missing. Please configure Cloudflare API Token.',
        this.name
      );
    }

    const model = options?.model || '@cf/meta/llama-3.1-8b-instruct';
    const maxTokens = options?.maxTokens ?? 1000;
    const timeoutMs = options?.timeoutMs ?? 10000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/ai/run/${model.trim()}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cloudflare AI API error (HTTP ${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      let content = '';

      if (typeof data.result?.response === 'string') {
        content = data.result.response;
      } else if (data.result?.choices?.[0]?.message?.content) {
        content = data.result.choices[0].message.content;
      } else if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
      } else if (typeof data.result === 'string') {
        content = data.result;
      }

      return {
        content,
        model,
        provider: this.name,
        promptTokens: data.result?.usage?.prompt_tokens,
        completionTokens: data.result?.usage?.completion_tokens,
        totalTokens: data.result?.usage?.total_tokens,
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
    model?: string,
    accountId?: string
  ): Promise<AiProviderHealth> {
    const startTime = Date.now();
    let keyToUse = apiKey || process.env.CLOUDFLARE_API_TOKEN;
    let accToUse = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;

    if (keyToUse && keyToUse.includes(':') && !accToUse) {
      const parts = keyToUse.split(':');
      accToUse = parts[0];
      keyToUse = parts.slice(1).join(':');
    }

    if (!accToUse || !accToUse.trim() || !keyToUse || !keyToUse.trim()) {
      return {
        provider: this.name,
        status: 'unavailable',
        message: 'Cloudflare Account ID and API Token not configured',
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const res = await this.generateCompletion(
        [{ role: 'user', content: 'Ping test. Reply with "pong".' }],
        {
          apiKey: keyToUse,
          accountId: accToUse,
          model: model || '@cf/meta/llama-3.1-8b-instruct',
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
// 4. PROVIDER REGISTRY & INSTANCES
// ═══════════════════════════════════════════════════════════════════════════

export { OpenRouterProvider as OpenRouterAiProvider };
export { OrcaRouterProvider as OrcaRouterAiProvider };

const openRouterProvider = new OpenRouterProvider();
const orcaRouterProvider = new OrcaRouterProvider();
const cloudflareAiProvider = new CloudflareAiProvider();

export function getProviderInstance(name: AiProviderName): AiProvider {
  if (
    defaultProvider &&
    defaultProvider !== openRouterProvider &&
    defaultProvider !== orcaRouterProvider &&
    defaultProvider !== cloudflareAiProvider
  ) {
    return defaultProvider;
  }
  if (name === 'orcarouter') {
    return orcaRouterProvider;
  }
  if (name === 'cloudflare') {
    return cloudflareAiProvider;
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
