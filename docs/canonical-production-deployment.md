# Canonical Production Deployment Architecture

**This file is a historical snapshot** of an Appwrite Sites topology that is no longer how Helpa runs.

Follow `docs/DEPLOYMENT.md` and `docs/production-workers.md` instead.

- Auth / database / storage: Supabase
- App runtime: Next.js 16 (`npm run build` / `npm start`)
- Worker: `npm run worker` (5s outbox poller)
- Scheduled jobs: HTTP routes in `src/app/api/cron/*`, `/api/automations/cron`, `/api/flows/cron`
- Rate limits: Redis when `REDIS_URL` is set
