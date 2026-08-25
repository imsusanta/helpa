# Canonical Deployment Architecture

**This file is a historical snapshot.** It previously described Appwrite Cloud Sites as the production host. That topology is obsolete.

**Current source of truth:**

- `docs/DEPLOYMENT.md`
- `docs/production-workers.md`
- `ROUTE_SECURITY_MATRIX.md`
- `docs/SUPABASE_CUTOVER_SIGN_OFF.md`

Production data and auth are **Supabase**. The Next.js app is deployed as a Node/Vercel (or equivalent) service. Redis is used for shared rate limits only. Background work is `npm run worker` plus HTTP crons — not BullMQ, not Appwrite functions.
