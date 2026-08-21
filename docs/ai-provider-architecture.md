# Helpa AI Engine — Multi-Provider Architecture

## Overview

The AI engine is a **provider-agnostic abstraction layer** supporting
**OpenRouter** and **OrcaRouter** as first-class LLM providers. Business logic
(AI receptionist, copilot, agent, knowledge-base retrieval, tool calling,
conversation memory) talks only to the Helpa AI engine, never to a vendor SDK.

```
                    HELPA AI ENGINE
              +------------+------------+
              ↓                         ↓
        OPENROUTER                 ORCAROUTER
   (openrouter.ai/api/v1)      (api.orcarouter.ai/v1)
              ↓                         ↓
   gemini · claude · llama        orcarouter/auto
              +------------+------------+
                           ↓
                  AI agent / copilot
                           ↓
                 AI tools / RAG / memory
                           ↓
                  Industry workflows
```

---

## 1. Provider contract

All providers implement `AiProvider` in `src/core/ai/provider.ts`:

```typescript
export interface AiProvider {
  name: AiProviderName
  capabilities: AiProviderCapabilities
  generateCompletion(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<AiCompletionResult>
  generateStream?(
    messages: AiMessage[],
    options?: AiCompletionOptions
  ): Promise<ReadableStream<string>>
  healthCheck(apiKey?: string, model?: string): Promise<AiProviderHealth>
}
```

Capabilities are declared per provider instead of assumed:
`supportsStreaming`, `supportsToolCalling`, `supportsStructuredOutput`,
`supportsVision`.

---

## 2. Integrated providers

### OpenRouter (`openrouter`)

- **Base:** `https://openrouter.ai/api/v1/chat/completions`
- **Default model:** `google/gemini-2.5-flash`
- **Also supported:** `anthropic/claude-3.5-sonnet`,
  `meta-llama/llama-3.3-70b-instruct`, custom identifiers
- **Env:** `OPENROUTER_API_KEY`

### OrcaRouter (`orcarouter`)

- **Base:** `https://api.orcarouter.ai/v1/chat/completions`
- **Default model:** `orcarouter/auto`
- **Env:** `ORCAROUTER_API_KEY`
- **Behavior:** server-side automatic routing across optimal models

---

## 3. Primary and bounded fallback routing

Provider selection and retries live in `src/core/ai/resolver.ts`:

1. **Primary execution** — up to 2 bounded retries with exponential backoff
   (500 ms, 1000 ms).
2. **Retryable errors** — 429 rate limits, 5xx, network timeouts, connection
   resets.
3. **Fail-fast errors (no fallback)** — 400 bad request, 401/403 auth failure,
   404 invalid model, policy rejection, tool execution error.
4. **Fallback execution** — on a retryable failure, the engine routes to the
   configured fallback provider.

---

## 4. Usage tracking and cost estimation

Every request is written to the audit pipeline by
`src/core/ai/usage-tracker.ts`:

- `workspace_id`, `conversation_id`
- `provider`: `openrouter` | `orcarouter`
- `model`: exact identifier executed
- `feature`: `AI_REPLY` | `AI_AGENT` | `AI_COPILOT` | `AI_SUMMARY` |
  `AI_SUGGESTED_REPLY` | `AI_SUGGESTED_ACTION` | `KNOWLEDGE_BASE` |
  `AUTOMATION` | `CAMPAIGN`
- `prompt_tokens`, `completion_tokens`, `total_tokens`, `latency_ms`
- `status`: `success` | `failed`
- `estimated_cost`: computed from known model pricing, and `undefined` when
  pricing is unknown rather than inventing a number

---

## 5. Security and tenant isolation

- **Keys at rest:** AES-256-GCM encrypted via `encrypt()` / `decrypt()`.
- **Server-side only:** keys never reach the browser, local storage, or API
  responses; the client sees only `has_openrouter_key` /
  `has_orcarouter_key` booleans.
- **Tenant scope:** workspace configuration is loaded server-side under a
  strict `account_id` filter, so one tenant can never read or mutate another
  tenant's credentials or AI logs.

---

## 6. Configuration surface

Managed in super admin and account settings
(`src/components/settings/ai-panel.tsx`).

System settings (`system_settings`): `system_openrouter_api_key` and
`system_orcarouter_api_key` (encrypted), `system_ai_provider`,
`system_ai_fallback_provider`, `system_openrouter_model`,
`system_orcarouter_model`, and the `available_models` list.

```
Super admin settings (system_settings)
               │
               ▼
     Helpa AI engine (resolver)
               │
     ┌─────────┼─────────┐
  Tenant A  Tenant B  Tenant C
```

Health checks: `GET /api/admin/ai/health`.

---

## 7. Adding a provider

1. Implement `AiProvider` in `src/core/ai/provider.ts`.
2. Add the name to `AiProviderName` in `src/core/ai/types.ts`.
3. Register the instance in `getProviderInstance(name)`.
4. Add credential fields to the settings schema if tenant-level keys apply.
5. No changes are needed in the agent, copilot, knowledge base, or industry
   modules.
