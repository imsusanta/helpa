# Helpa Documentation

All project documentation lives in this folder. The repository root intentionally
contains only `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`,
`CHANGELOG.md`, and tooling config.

## Start here

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System overview, core vs. industry modules, subsystem inventory |
| [core-platform-architecture.md](./core-platform-architecture.md) | Service boundaries inside `src/core/` and data ownership |
| [ai-provider-architecture.md](./ai-provider-architecture.md) | Provider-agnostic AI engine, fallback routing, usage metering |
| [testing.md](./testing.md) | Test topology, suites, and E2E critical paths |
| [walkthrough.md](./walkthrough.md) | How the clinic workflows and webhook pipeline were built |

## Security

| Document | What it covers |
| --- | --- |
| [security/threat-model.md](./security/threat-model.md) | Assets, threat scenarios, mitigations, residual risk |
| [security/data-security-model.md](./security/data-security-model.md) | Data classification, tenant isolation, key management |
| [security/route-security-matrix.md](./security/route-security-matrix.md) | Per-route auth, role, scoping, and rate-limit policy |
| [../SECURITY.md](../SECURITY.md) | Vulnerability disclosure policy |

## Operations & deployment

| Document | What it covers |
| --- | --- |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Environment setup and deploy procedure |
| [canonical-production-deployment.md](./canonical-production-deployment.md) | Canonical production deployment reference |
| [OPERATIONS.md](./OPERATIONS.md) | Runbooks and on-call procedures |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Pre-release verification checklist |
| [production-workers.md](./production-workers.md) | Background worker and reminder queue operation |

## Integrations

| Document | What it covers |
| --- | --- |
| [whatsapp-embedded-signup.md](./whatsapp-embedded-signup.md) | Meta 1-click Embedded Signup flow |
| [VOICE_SETUP.md](./VOICE_SETUP.md) | Voice note transcription setup |
| [META_MCP_INTEGRATION.md](./META_MCP_INTEGRATION.md) | Meta MCP tooling integration |

## Planning

| Document | What it covers |
| --- | --- |
| [10-OUT-OF-10-ROADMAP.md](./10-OUT-OF-10-ROADMAP.md) | Current roadmap and quality targets |
| [adr/](./adr) | Architecture decision records |

> Historical audit snapshots (production-readiness reports, recovery audits,
> point-in-time gap analyses) were removed from the working tree to keep
> documentation trustworthy. They remain available in git history.
