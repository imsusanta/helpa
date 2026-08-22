# Security Policy

## Reporting a vulnerability

Do **not** open a public GitHub issue for a suspected security vulnerability.
Public issues may expose customers and deployments before a fix is available.

Report privately through one of these channels:

- [GitHub Private Vulnerability Reporting](https://github.com/imsusanta/helpa/security/advisories/new) (preferred)
- Email: `susantalohr@gmail.com` with `[Helpa security]` in the subject

Include, when possible:

- A description of the issue and its potential impact
- Minimal reproduction steps or a proof of concept
- The affected commit, route, or release
- Sanitized request/response details with no real customer or patient data
- Whether you want public credit after coordinated disclosure

## Response targets

- Acknowledgement within 72 hours
- Initial severity and scope assessment within seven days
- Critical and high-severity remediation as soon as safely possible
- Coordinated disclosure only after a fix and reasonable deployment window

These are response targets, not contractual service-level guarantees.

## Scope

In scope:

- Helpa application code and default configuration in this repository
- Authentication, authorization, tenant isolation, Supabase RLS and migrations
- Webhooks, token encryption, billing, cron endpoints, and CI/CD configuration
- Unsafe defaults in documentation maintained by this repository

Out of scope:

- Upstream vulnerabilities in third-party services and dependencies, unless Helpa's integration makes the impact worse
- Social engineering and physical attacks
- Availability testing that causes disruption or data loss
- Third-party modifications not shipped by this repository

## Safe harbor

Good-faith research performed under this policy is authorized when the researcher:

- Avoids accessing, modifying, or retaining real customer or patient data
- Avoids privacy violations, destructive testing, and service disruption
- Uses the minimum access needed to demonstrate the issue
- Allows reasonable time for remediation before public disclosure

Thank you for helping keep Helpa and its users safe.
