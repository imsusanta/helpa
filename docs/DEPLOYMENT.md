# Helpa Production Deployment Guide

Helpa runs as a Next.js application on Appwrite Sites with Appwrite Auth,
Databases, Storage, and Teams.

## Required environment variables

Set these in the Appwrite Site environment configuration:

| Variable                          | Scope       | Purpose                                             |
| --------------------------------- | ----------- | --------------------------------------------------- |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT`   | Public      | Appwrite API endpoint                               |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Public      | Appwrite project ID                                 |
| `APPWRITE_API_KEY`                | Server-only | Server SDK access to Databases and Storage          |
| `APPWRITE_DATABASE_ID`            | Server-only | Appwrite database ID                                |
| `NEXT_PUBLIC_SITE_URL`            | Public      | Canonical site URL, e.g. `https://www.helpa.studio` |
| `ENCRYPTION_KEY`                  | Server-only | 64-character AES-256-GCM key                        |
| `PDF_SIGNING_KEY`                 | Server-only | HMAC key for public appointment PDFs                |
| `META_APP_SECRET`                 | Server-only | Meta webhook signature verification                 |
| `REDIS_URL`                       | Server-only | BullMQ worker and queue connection                  |
| `CRON_SECRET`                     | Server-only | Cron route protection                               |

Copy `.env.local.example` for local development, then fill in real values.
Never expose `APPWRITE_API_KEY`, `ENCRYPTION_KEY`, or signing keys to the browser.

## Provision Appwrite

After creating the Appwrite project and API key, provision the database,
collections, and buckets:

```bash
npm ci
npm run appwrite:setup
npm run appwrite:verify
```

The Appwrite project must include the production site domain under Platforms
and the Auth redirect URL configuration. Add:

- `https://www.helpa.studio`
- `https://www.helpa.studio/login`
- `https://www.helpa.studio/dashboard`
- `https://www.helpa.studio/join/*`

## Build and deploy

Use the Appwrite Sites Git deployment with:

```text
Build command: npm run build
Install command: npm ci
Output: Next.js server deployment
```

The post-deployment workflow checks `/`, `/login`, and `/api/health` at
`https://www.helpa.studio`.

## Local verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If Appwrite service reports a quota error, resolve the quota or spend cap in
the Appwrite project console; the application no longer contacts Supabase.
