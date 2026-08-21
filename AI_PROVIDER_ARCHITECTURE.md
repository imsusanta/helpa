# Helpa AI provider architecture

This document is the current source of truth for Helpa's AI-provider layer.

## Scope

The AI layer routes tenant-scoped requests through OpenRouter, OrcaRouter, or Cloudflare Workers AI. It provides model selection, bounded retries, optional provider fallback, usage telemetry, safety screening, and human handoff.

Relevant implementation:

- [`src/core/ai/resolver.ts`](./src/core/ai/resolver.ts) — provider and model resolution, retry, fallback.
- [`src/core/ai/provider.ts`](./src/core/ai/provider.ts) — provider adapters.
- [`src/core/ai/engine.ts`](./src/core/ai/engine.ts) — context, safety, tools, and handoff.
- [`src/core/ai/usage-tracker.ts`](./src/core/ai/usage-tracker.ts) — usage and cost telemetry.
- [`src/core/knowledge/index.ts`](./src/core/knowledge/index.ts) — tenant-scoped lexical knowledge retrieval.

## Request path

```text
Tenant request
  -> authenticated account context
  -> industry safety screening
  -> tenant-scoped context and knowledge lookup
  -> provider/model resolver
  -> primary provider (bounded retry)
  -> optional fallback provider
  -> usage telemetry
  -> response or human handoff
```

## Security boundaries

1. Every request must carry a server-validated `accountId`; a browser-provided tenant ID is never authoritative.
2. Tenant knowledge queries always include `account_id`.
3. API credentials stay server-side and encrypted at rest when stored in the database.
4. Decrypted keys, prompts containing personal data, and full provider responses must not be logged.
5. Knowledge articles are reference data, not trusted instructions. The formatter explicitly isolates them from the system prompt.
6. Provider fallback must not bypass subscription, model, safety, or tenant policy.

## Knowledge grounding status

Current retrieval is **keyword/lexical grounding**, not semantic vector RAG. It fetches a bounded tenant-only candidate set, scores query terms, removes zero-score articles, and returns only the best matches. Do not describe this implementation as embeddings or semantic search.

A future vector implementation must include tenant-scoped vector indexes, document/chunk provenance, deletion propagation, prompt-injection evaluation, retrieval quality tests, and a safe fallback to lexical search.

## Cost and availability controls

Current controls include bounded output sizes at each call site, bounded retry attempts, optional provider fallback, and tenant-attributed token/cost telemetry. Production launch additionally requires:

- plan-level AI request limits enforced before provider calls;
- per-tenant monthly token or currency budgets;
- a provider circuit breaker shared across instances;
- alerts for spend acceleration, fallback spikes, and repeated provider failures;
- prompt/model versioning and an evaluation set for every high-risk workflow.

These are launch gates, not optional dashboard enhancements. See [`docs/operations/SAAS_PRODUCTION_RUNBOOK.md`](./docs/operations/SAAS_PRODUCTION_RUNBOOK.md).

## Provider configuration

Server-side variables:

```bash
OPENROUTER_API_KEY=
ORCAROUTER_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

Tenant or system overrides may be stored encrypted in database settings. If a stored credential cannot be decrypted, the resolver must treat it as unavailable rather than using ciphertext as an API key.

## Release checklist

- [ ] Tenant authorization is verified before context assembly.
- [ ] Subscription and AI quota checks pass before the provider call.
- [ ] Maximum prompt and completion sizes are bounded.
- [ ] Tool calls are allowlisted and write tools require the intended confirmation policy.
- [ ] Knowledge retrieval tests include cross-tenant and prompt-injection cases.
- [ ] Usage writes and budget reservations are observable.
- [ ] Primary and fallback provider failure paths are tested.
- [ ] Logs contain no secrets or sensitive prompt bodies.
