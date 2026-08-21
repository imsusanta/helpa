# Helpa 10/10 Engineering Roadmap

This document is the canonical improvement plan for moving Helpa from a strong early-production SaaS to an operationally mature platform. Historical audit reports remain evidence; this roadmap owns current priorities.

## Definition of 10/10

Helpa reaches the target when every item below has objective, reproducible evidence:

- Security gates fail closed and block merges.
- Every production deployment is traceable to an immutable commit SHA.
- Critical user journeys pass in CI and production smoke tests.
- Tenant isolation is enforced at the application and database layers.
- Security-critical modules meet explicit test-coverage thresholds.
- Performance and reliability targets are measured, alerted, and reviewed.
- Public version, release, deployment, and product claims are consistent.
- The primary customer profile has a focused onboarding and activation journey.

## P0 — Merge protection and release truthfulness

- [x] Make secret scanning blocking.
- [x] Split CI into independently visible quality, test, security, build, and E2E gates.
- [ ] Require all CI jobs through branch protection on `main`.
- [ ] Reconcile the public version badge, GitHub release, package version, and deployed SHA.
- [ ] Close or reconcile stale WhatsApp Embedded Signup pull requests.
- [ ] Publish a stable release only after post-deployment SHA verification succeeds.

**Exit evidence:** protected `main`, green required checks, stable release tag, and matching `/api/health` SHA.

## P1 — Maintainability and test confidence

- [ ] Refactor dashboard pages larger than 400 lines into feature components, hooks, and service modules.
- [x] Add coverage reporting with minimum thresholds for authentication, tenant guards, webhook verification, billing, outbox, and encryption modules.
- [x] Add contract tests for Meta WhatsApp and payment-provider boundaries.
- [ ] Add migration rollback tests and restore drills.
- [x] Consolidate overlapping audit documents under `docs/audits/` and maintain one current readiness report.

**Exit evidence:** enforced coverage thresholds, no oversized route components without an exception, and a tested rollback procedure.

## P2 — Reliability and observability

- [ ] Define service-level indicators for API availability, webhook processing, message delivery, appointment booking, and background jobs.
- [ ] Set service-level objectives and alert thresholds.
- [x] Add correlation IDs across inbound webhooks, outbox records, provider calls, and reconciliation workers.
- [ ] Add dashboards for queue depth, delivery latency, provider errors, tenant-scoped failures, and reconciliation backlog.
- [ ] Run backup-restore, provider-outage, and duplicate-webhook game days.

**Exit evidence:** actionable alerts, documented ownership, and successful recovery exercises.

## P3 — Product focus and customer proof

- [ ] Select one launch ICP and make the homepage, onboarding, demo data, and activation checklist specific to it.
- [ ] Track time-to-first-value, onboarding completion, conversation automation rate, booking conversion, and retained weekly usage.
- [ ] Add accessibility checks to CI and complete keyboard-only testing of critical flows.
- [ ] Set performance budgets for Core Web Vitals and major dashboard routes.
- [ ] Validate legal, privacy, retention, and healthcare claims with qualified reviewers before expanding clinical deployment.

**Exit evidence:** measurable activation and retention targets, accessibility conformance evidence, and reviewed compliance claims.

## Recommended branch-protection checks

Require these checks before merge:

1. `Formatting, lint, and types`
2. `Unit, integration, and migration tests`
3. `Secrets and dependency security`
4. `Production build`
5. `Critical-path browser tests`

Also require pull requests, dismissal of stale approvals, resolution of review conversations, and no force pushes to `main`.

## Scorecard

Review this scorecard at each stable release:

| Area | Target | Evidence |
| --- | ---: | --- |
| Security | 10/10 | Blocking scans, threat tests, dependency policy |
| Reliability | 10/10 | SLOs, alerts, drills, deployment verification |
| Test confidence | 10/10 | Coverage thresholds and critical-path tests |
| Maintainability | 10/10 | Bounded modules and documented architecture |
| Release discipline | 10/10 | Protected branch and traceable stable releases |
| Product quality | 10/10 | Focused ICP, accessibility, performance, activation |

A release is not labeled 10/10 because a document says so. It earns the label when the evidence above is current and reproducible.
