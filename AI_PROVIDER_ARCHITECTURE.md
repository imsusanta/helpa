# Helpa AI Engine — Multi-Provider Architecture Documentation

## Overview

Helpa's AI Engine is built on a **provider-agnostic abstraction layer** that supports **OpenRouter** and **OrcaRouter** as first-class LLM providers. Business logic (AI Receptionist, AI Copilot, AI Agent, Knowledge Base/RAG, Tool Calling, and Conversation Memory) communicates exclusively with the **Helpa AI Engine** rather than locking into any single LLM vendor SDK.

```
                    HELPA AI ENGINE
                           |
              +------------+------------+
              |                         |
              ↓                         ↓
        OPENROUTER                 ORCAROUTER
   (openrouter.ai/api/v1)      (api.orcarouter.ai/v1)
              |                         |
           Models                    Models
   (gemini, claude, llama)       (orcarouter/auto)
              |                         |
              +------------+------------+
                           ↓
                  AI Agent / Copilot
                           ↓
                 AI Tools / RAG / Memory
                           ↓
                  Industry Workflows
```

---

## 1. Provider Abstraction Contract

All LLM providers implement the `AiProvider` interface defined in [`src/core/ai/provider.ts`](file:///Users/susantalohar/Documents/wacrm/src/core/ai/provider.ts):

```typescript
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
```

### Capability Detection

Capabilities are declared per-provider without assuming every model supports every feature:

- `supportsStreaming`: `boolean`
- `supportsToolCalling`: `boolean`
- `supportsStructuredOutput`: `boolean`
- `supportsVision`: `boolean`

---

## 2. Integrated Providers

### OpenRouter (`openrouter`)

- **API Base**: `https://openrouter.ai/api/v1/chat/completions`
- **Default Model**: `google/gemini-2.5-flash`
- **Supported Models**: `anthropic/claude-3.5-sonnet`, `meta-llama/llama-3.3-70b-instruct`, custom identifiers.
- **Environment Variable**: `OPENROUTER_API_KEY`

### OrcaRouter (`orcarouter`)

- **API Base**: `https://api.orcarouter.ai/v1/chat/completions`
- **Default Model**: `orcarouter/auto`
- **Environment Variable**: `ORCAROUTER_API_KEY`
- **Features**: Automatic intelligent routing across optimal models via server-side Bearer authentication.

---

## 3. Primary & Bounded Fallback Routing

Provider selection and retry management is handled by [`src/core/ai/resolver.ts`](file:///Users/susantalohar/Documents/wacrm/src/core/ai/resolver.ts):

1. **Primary Provider Execution**: Up to 2 bounded retries with exponential backoff (500ms, 1000ms).
2. **Retryable Error Filter**:
   - **Triggers Fallback**: 429 Rate limits, 5xx Server errors, network timeouts, connection resets.
   - **Skips Fallback (Fails Fast)**: 400 Bad Request, 401/403 Authentication failure, 404 Invalid model, Policy rejection, Tool execution error.
3. **Fallback Provider Execution**: If Primary Provider fails with a retryable error, the engine seamlessly routes to the configured Fallback Provider.

---

## 4. Usage Tracking & Cost Estimation

Every request is logged to the audit log pipeline via [`src/core/ai/usage-tracker.ts`](file:///Users/susantalohar/Documents/wacrm/src/core/ai/usage-tracker.ts):

- `workspace_id`: Tenant workspace context
- `conversation_id`: Linked customer chat
- `provider`: `openrouter` | `orcarouter`
- `model`: Exact model identifier executed
- `feature`: `AI_REPLY` | `AI_AGENT` | `AI_COPILOT` | `AI_SUMMARY` | `AI_SUGGESTED_REPLY` | `AI_SUGGESTED_ACTION` | `KNOWLEDGE_BASE` | `AUTOMATION` | `CAMPAIGN`
- `prompt_tokens`, `completion_tokens`, `total_tokens`
- `latency_ms`
- `status`: `success` | `failed`
- `estimated_cost`: Computed based on model pricing (returns `undefined` if model pricing is unknown rather than inventing arbitrary numbers).

---

## 5. Security & Tenant Isolation

- **API Keys**: Stored encrypted at rest using AES-256 (`encrypt()` / `decrypt()`).
- **Server-Side Only**: Keys are never sent to the browser, browser local storage, or frontend responses (`has_openrouter_key` / `has_orcarouter_key` boolean flags only).
- **Tenant Scope**: Workspace configuration is retrieved server-side using strict `account_id` filters. Tenant A can never read or mutate Tenant B credentials or AI logs.

---

## 6. Super Admin & Settings UI

Configurable in Super Admin / Account Settings ([`src/components/settings/ai-panel.tsx`](file:///Users/susantalohar/Documents/wacrm/src/components/settings/ai-panel.tsx)):

- **Super Admin System Settings (`system_settings`)**:
  - `system_openrouter_api_key` & `system_orcarouter_api_key` (encrypted at rest)
  - `system_ai_provider` & `system_ai_fallback_provider`
  - `system_openrouter_model` & `system_orcarouter_model`
  - `available_models` list
- **Resolution Hierarchy**:
  ```
  SUPER ADMIN Settings (system_settings)
               │
               ▼
        HELPA AI ENGINE (Resolver)
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
  Tenant A  Tenant B  Tenant C
  ```
- **Health Checks**: Super Admin health API at `GET /api/admin/ai/health`.

---

## 7. Adding Future Providers

To add a new AI provider (e.g. OpenAI, Anthropic, Google, Groq, DeepSeek):

1. Create adapter class implementing `AiProvider` in [`src/core/ai/provider.ts`](file:///Users/susantalohar/Documents/wacrm/src/core/ai/provider.ts).
2. Register the provider name in `AiProviderName` type in [`src/core/ai/types.ts`](file:///Users/susantalohar/Documents/wacrm/src/core/ai/types.ts).
3. Add instance to `getProviderInstance(name)` registry in `src/core/ai/provider.ts`.
4. Add credential fields to `accounts` table / settings schema if tenant-level keys are supported.
5. Zero changes required in AI Agent, Copilot, Knowledge Base, or Industry modules!
