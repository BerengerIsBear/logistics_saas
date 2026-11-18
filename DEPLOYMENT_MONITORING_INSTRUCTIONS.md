# Phase 7.4 — Deploy on Vercel + Basic Monitoring

This patch adds only `app/api/health/route.ts`. It checks whether the Next.js app can reach Supabase and returns HTTP **200** (`{"status":"ok"}`) or **503** (`{"status":"unhealthy"}`). It returns no company data, no secrets, and no database error messages. **It is a health check, not a full security audit or backup.**

**No SQL, new packages, Vercel config file, or existing code replacements.** The project already contains the server-side Supabase client used by this endpoint.

> **Safety first:** Employee/API access testing was intentionally skipped. Do **not** invite external businesses or publish a self-service demo against the existing Supabase production data yet. Start with a private Vercel deployment. The Supabase dashboard labels the existing project `PRODUCTION`, even though it currently contains test jobs.

## 1. Install and validate locally

1. Copy the patch **contents** to the root of `logistics_saas` (merge `app/` folders).
2. In VS Code terminal (your project root):

   ```powershell
   npm run lint
   npx tsc --noEmit
   npm run build
   ```

3. Start the app (`npm run dev`), then visit `http://localhost:3000/api/health`.
   - `200 {"status":"ok"}`: app can query Supabase.
   - `503 {"status":"unhealthy"}`: check your Supabase environment variables and project state.
4. Confirm secrets are not tracked:

   ```powershell
   git ls-files .env.local .env.tenant-test.local
   ```

   This should print nothing. The current `.gitignore` already contains `.env*`.
5. Commit **just the deployment patch**, then push to your existing `main` branch:

   ```powershell
   git add app/api/health/route.ts DEPLOYMENT_MONITORING_INSTRUCTIONS.md
   git status
   git commit -m "chore: add deployment health check and runbook"
   git push origin main
   ```

   **Do not** stage or upload `.env.local` or `.env.tenant-test.local`.

## 2. Connect GitHub to Vercel

1. Open Vercel, choose **Add New → Project → Import Git Repository** and select your `logistics_saas` repository.
2. Framework: **Next.js** (auto-detected). Root directory: **`./`**. Keep the default build setup. You do not need `vercel.json` or a Vercel Cron job.
3. Under project **Settings → Environment Variables**, enter the following values **from your current local `.env.local` or the corresponding Supabase project settings**. Enter values in the dashboard—**never commit them**.

   | Variable | Value | Visibility |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Public browser config |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key used by this app | Public browser config |
   | `SUPABASE_URL` | Same Supabase Project URL | Server |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret | **Server secret: never `NEXT_PUBLIC_`** |
   | `APP_URL` | `https://<your-actual-vercel-production-domain>` | Server |

   Choose **Production** for this initial deployment. If you later enable Preview deployments, connect them to a **separate testing Supabase project** with separate Preview environment variables, **not** the live database. Vercel uses different env sets for Production and Preview.
4. Deploy. Vercel will give you the real hostname, often `https://your-project.vercel.app`. If `APP_URL` differs from that hostname, edit it to the **exact** HTTPS origin (no trailing path) and **Redeploy**. This is needed for invitation redirects and cross-origin write checks.
5. Since this is a business/licensing project, use a commercial-compatible Vercel plan (Pro or Enterprise) rather than Hobby (non-commercial use only).

## 3. Keep it private during testing

Before sharing the link, open **Vercel Project → Settings → Deployment Protection**. Select **All Deployments** with **Vercel Authentication** to restrict both preview and production URLs. This is currently available on all Vercel plans. Only authorized Vercel users can open the protected deployment.

**Note:** When Vercel Authentication protects all deployments, outside uptime monitors and external invitation recipients may see Vercel's protection screen. That's expected. Use your signed-in browser and Vercel's own logs for private testing. Open access only when the remaining security tests are complete and you have a separate demo environment.

## 4. Update Supabase Auth URLs

In **Supabase → Authentication → URL Configuration**:

- **Site URL**: `https://<your-actual-vercel-production-domain>`
- Add **Redirect URLs** (use exact paths for production):
  - `https://<your-actual-vercel-production-domain>/accept-invite`
  - `https://<your-actual-vercel-production-domain>/login`
  - Keep `http://localhost:3000/accept-invite` and `http://localhost:3000/login` for local tests.

If you use email invitations, confirm the existing Invite email template uses `{{ .ConfirmationURL }}` and your custom SMTP is configured for real external recipients. A protected deployment may block recipients not authorized in Vercel.

## 5. Check the deployment

Open in a signed-in browser:

1. `/api/health` → JSON `{"status":"ok"}` and HTTP 200.
2. `/login` → log in to a **test** account.
3. `/jobs` → your test company's jobs.
4. `/admin-audit` → log visible only to Admin; create one test workflow if needed.
5. `/workflow-escalations` → opens. **Supabase Cron** still runs in Supabase; Vercel doesn't schedule it.
6. Log out → protected management pages redirect to login.

If `/api/health` is 503, check **Vercel → Deployments → your deployment → Runtime Logs**, and confirm the five environment variable values and Supabase project. **Do not print tokens in logs or screenshots.**

## 6. Monitoring, without more code

- **Availability:** Check `/api/health` after each deployment. When public launch is authorized, an external HTTPS uptime monitor can check it periodically and alert on HTTP 503/timeouts. Until then, deployment protection may block external checks.
- **Errors:** Review **Vercel → Observability / Runtime Logs** for HTTP 500s and repeated errors.
- **Cron:** Supabase scheduled escalation scans are independent of Vercel. In Supabase SQL Editor, this *read-only* query checks the schedule:

  ```sql
  SELECT jobname, schedule, active
  FROM cron.job
  WHERE jobname = 'workflow-stage-escalations';
  ```

- **Rollback:** If a code deployment fails, open Vercel **Deployments** and promote/rollback to a previously working deployment. This does **not** undo Supabase SQL changes.

### What remains unverified before a real enterprise pilot

- Employee disable/enable, Driver and Dispatcher API permission tests (previously **skipped**).
- Cross-tenant write and POD download tests (earlier read-only script had **2 skipped checks**).
- Database restore drills, complete end-to-end testing, and external-user access.

**Success for this task:** Vercel build succeeds, production URL opens **privately**, `/api/health` returns 200, login + jobs + admin audit work, and runtime logs are accessible. Do not describe the system as fully production-ready until the remaining tests pass.
