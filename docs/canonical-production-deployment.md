# Canonical Production Deployment Architecture

**Production Domain**: `https://www.helpa.studio`  
**Authoritative Backend & Site Host**: Appwrite Cloud Sites (Cluster: `sgp`, Project ID: `6a79822b003adde92f63`, Database ID: `helpa_main`)  
**Production Branch**: `main`  
**Build Command**: `npm run build` (`next build --webpack`)  
**Runtime**: Next.js 16 (Node.js 22 LTS / Swoole Container Engine on Appwrite Sites)

---

## 1. Single Source of Truth

The authoritative production infrastructure serving all user traffic at `https://www.helpa.studio` is **Appwrite Sites**:

- **Hosting Engine**: Appwrite Cloud (Singapore `sgp` Edge Cluster)
- **Project ID**: `6a79822b003adde92f63`
- **Database Engine**: Appwrite Databases (`helpa_main`)
- **Storage Buckets**: `chat-media`, `lab-reports`, `medical-records`
- **Custom Domain Mapping**: `www.helpa.studio` and `helpa.studio` routed to Appwrite Edge DNS.

---

## 2. Disambiguation of Secondary & Preview Projects

### Non-Canonical Projects

- **Vercel Project `wacrm`**: Legacy preview / staging deployment.
- **Vercel Project `wacrm_susanta`**: Duplicate developer preview deployment.

### Manual Steps to Disconnect / Archive Duplicate Targets

1. **Vercel Dashboard**:
   - Navigate to `wacrm_susanta` → **Settings** → **Git** → click **Disconnect Git Repository**.
   - Navigate to `wacrm` → **Settings** → **Domains** → verify no production traffic is routed from `www.helpa.studio`.
2. **GitHub Repository Settings**:
   - Go to **Settings** → **Branches** → **Branch protection rules** for `main`.
   - In **Require status checks to pass before merging**, uncheck any non-canonical Vercel preview checks (e.g. `Vercel – wacrm_susanta`).
   - Keep only the canonical CI check: `Production Quality & Security Gates`.

---

## 3. Deployment SHA Resolution Order

The `/api/health` endpoint evaluates commit identity server-side using the following strict precedence:

1. `APP_COMMIT_SHA` (Injected build/runtime commit variable)
2. `VERCEL_GIT_COMMIT_SHA` (Vercel deployment environment)
3. `GITHUB_SHA` (GitHub Actions CI/CD commit)
4. `SOURCE_VERSION` (Container engine deployment revision)
5. `src/lib/build-info.json` (Generated locally during `npm run build`)

All commit strings are verified with `/^[0-9a-f]{40}$/i` and normalized to lowercase full 40-character hex strings.

---

## 4. Post-Deployment Verification Policy

The GitHub Actions workflow [`.github/workflows/post-deploy.yml`](file:///.github/workflows/post-deploy.yml) runs [`scripts/verify-deployment.mjs`](file:///scripts/verify-deployment.mjs) on every merge to `main`:

1. Queries `https://www.helpa.studio/api/health?verify_sha=${EXPECTED_SHA}&attempt=${ATTEMPT}` with cache-busting.
2. Extracts `commit` and `deploymentShaStatus`.
3. Verifies `commit === EXPECTED_SHA` and `deploymentShaStatus === "available"`.
4. Verifies `checks.database === "healthy"`.
5. Retries up to 30 bounded attempts (10s intervals, 8s per-request timeout) to allow edge DNS propagation.
6. Emits redacted verification evidence to `artifacts/deployment-verification.json` and `artifacts/deployment-verification.md`.

---

## 5. Rollback Procedure

If a production regression occurs after merging a release:

```bash
# Option A: Revert the merge commit on main
git checkout main
git pull origin main
git revert -m 1 <MERGE_COMMIT_SHA>
git push origin main

# Option B: Fast-forward deploy previous verified main commit
git checkout main
git reset --hard a7fdfd7633dadda4899a9b827abae813782b5172
git push origin main --force-with-lease
```

Appwrite Sites will automatically detect the new commit on `main` and trigger an atomic redeployment.
