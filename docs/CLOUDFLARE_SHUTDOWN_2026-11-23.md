# OMNIFORGE — Cloudflare disconnection audit (23 November 2026)

## Scope
Audited the only currently visible linked GitHub repository: `fayemijames42-cell/omniforge-mike`. This is **not** a Cloudflare account inventory. Other Cloudflare resources cannot be ruled out without dashboard access.

## Observed Cloudflare connections and their status
- `wrangler.jsonc`: Worker previously named `omniforge-mike`. On the inspected default branch it already points to `cloudflare-retired.js`, with `workers_dev: false`, `preview_urls: false`, empty routes and cron triggers, and no `ai` or `assets` bindings. Durable Object migration identifiers `DAILY_BUDGET` and `MIKEE_POOL` remain for compatibility; no storage calls are made by the retired handler.
- `cloudflare-retired.js`: returns HTTP 410 to all requests without calling Cloudflare AI or storage.
- `worker.js`, `server/providers.js`, `server/coordinator.js` and `server/pool-http.js`: old Cloudflare Worker/AI and provider implementation retained as historical source and for existing regression tests; not the configured deployment entry point. **Code left in a repository does not itself execute or incur Worker usage.**
- `package.json`: removed the `deploy: wrangler deploy` script and the Wrangler dependency, making the supported npm project path incapable of deploying to Cloudflare.
- `package-lock.json`: removed Wrangler and transitive Cloudflare/Workerd packages from the npm lock. Remaining dev dependency is Acorn.
- `.github/workflows/verify.yml`: removed the Wrangler dry-run step and telemetry configuration. The normal Node/browser verification job remains.
- `.github/workflows/reference-bank.yml`: still periodically retrieves Wikipedia source material and publishes to GitHub; this is **not** a Cloudflare deployment or Cloudflare AI call.
- Tests now include `tests/cloud-retirement.test.mjs` in the standard npm test path.

## What has NOT been verified or disconnected
This audit does **not** have direct Cloudflare account control or a valid Cloudflare API token. GitHub file changes cannot cancel a subscription or delete remotely deployed Workers. Live service accessibility could not be positively established.

To stop **further Cloudflare charges**, an authorized Cloudflare account owner must:
1. Open [Cloudflare dashboard](https://dash.cloudflare.com/) and go to Workers & Pages; review Worker `omniforge-mike` and any other Workers or Pages projects, their routes, custom domains, traffic, triggers and linked GitHub deployments. Disable or delete unwanted deployments. First export any data that must be retained.
2. Check Workers AI, Durable Objects, R2, D1, KV, Queues and other billable resources in the account. Remove **unused** billable resources, after exporting anything needed; deleting Worker code alone may leave subscriptions/storage.
3. Check **Billing → Subscriptions / Plans** to cancel the Workers Paid plan and any paid add-ons. Deleting a Worker does **not** necessarily cancel a recurring plan or an existing invoice.
4. Under **My Profile → API Tokens**, revoke Cloudflare tokens used for deployment. Remove Cloudflare deployment secrets from any GitHub repository/CI and disconnect Cloudflare-to-GitHub automatic deploy integrations in Cloudflare settings.
5. Recheck billing/subscriptions and last request/usage totals. A paid period already incurred may still generate its final invoice.

## Reliability distinction
OMNIFORGE's current browser/offline logic handles stored reference lookup, simple deterministic tools and local project files. It has **not** been independently established to run a general-purpose language model entirely on-device. Cloudflare can be decommissioned now without claiming a replacement AI already works.

## Do not reactivate
Do not re-add `wrangler deploy`, `npx wrangler deploy`, Worker AI bindings or cloud deploy secrets to a running workflow unless an account owner explicitly changes the no-cloud policy.
