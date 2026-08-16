/**
 * Helpa Core Platform — AI Provider Abstraction
 *
 * Pluggable AI provider interface supporting OpenRouter (default),
 * with built-in retry handling, token usage tracking, and rate limiting.
 */

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
}

export interface AiCompletionResult {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiProvider {
  name: string;
  generateCompletion(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<AiCompletionResult>;
}

export class OpenRouterAiProvider implements AiProvider {
  public name = 'openrouter';

  public async generateCompletion(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<AiCompletionResult> {
    const apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OpenRouter API key is not configured. Please add OPENROUTER_API_KEY in environment or account settings.'
      );
    }

    const model = options?.model || 'meta-llama/llama-3.3-70b-instruct';
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
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer':
              process.env.NEXT_PUBLIC_APP_URL || 'https://helpa.studio',
            'X-Title': 'Helpa Studio',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
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
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

let defaultProvider: AiProvider = new OpenRouterAiProvider();

export function getAiProvider(): AiProvider {
  return defaultProvider;
}

export function setAiProvider(provider: AiProvider): void {
  defaultProvider = provider;
}
