# ADR 0001: Enforce application module boundaries

- Status: Accepted
- Date: 2026-09-04

## Context

Helpa contains route handlers, reusable core services, industry modules, and external adapters. As the product grows, accidental imports from UI or route code into the core layer make business logic harder to test and increase coupling to Next.js.

## Decision

Helpa uses the following dependency direction:

```text
app routes and UI -> application/industry modules -> core ports and domain policy -> infrastructure adapters
```

The `src/core` layer must not import from `src/app` or `src/components`. Core code may expose ports and domain policy; Next.js route handlers and React components remain delivery adapters.

Industry-specific behavior belongs behind the industry port instead of being selected through new hard-coded branches in the core AI engine.

Tenant-aware reads and writes must receive the authenticated account ID from the application boundary and fail closed when the referenced record is outside that account.

## Enforcement

`src/tests/architecture/module-boundaries.test.ts` scans source imports and fails CI when core code imports application routes or UI components.

Additional boundaries will be introduced incrementally as existing code is extracted:

1. Route handlers delegate to application services.
2. Domain policy stops importing database clients.
3. Database access moves behind tenant-scoped repositories.
4. External delivery uses transactional outbox records.

## Consequences

- Architecture regressions become visible in CI.
- Refactors can proceed in small, reviewable pull requests.
- Existing behavior is unchanged by this ADR.
- New boundaries are added only after the affected legacy code is migrated, keeping `main` green.
