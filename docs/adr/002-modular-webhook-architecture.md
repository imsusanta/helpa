# ADR 002: Modular Webhook Architecture Decomposition

## Status

Accepted and Enforced (2026-08)

## Context

The monolithic `src/app/api/whatsapp/webhook/route.ts` grew beyond 1,400 lines, mixing GET verification, HMAC checking, media retrieval, contact deduplication, appointment confirmation button handling, lab report delivery, Flows engine execution, and AI triggering in a single file.

## Decision

Decompose the route into cohesive, single-responsibility submodules:

- `route.ts`: Minimal router (<95 lines) handling HTTP verbs and signature gating.
- `verify-request.ts`: Meta hub subscription challenge and verify token verification.
- `types.ts`: Strongly typed data contracts.
- `parse-event.ts`: Content extraction and media proxy construction.
- `contact-service.ts`: Deduplication and auto-sequential patient ID assignment (`PAT-XXXXXX`).
- `conversation-service.ts`: Conversation retrieval and broadcast reply reconciliation.
- `process-reaction.ts`: Emoji reaction upserts.
- `process-status.ts`: Message status ladder updates.
- `process-message.ts`: Inbound message dispatch, reminder button actions, lab report downloads, and AI triggers.

## Consequences

- **Positive**: 100% testable, maintainable, single-responsibility architecture.
- **Positive**: Isolated submodules allow targeted unit and integration tests.
