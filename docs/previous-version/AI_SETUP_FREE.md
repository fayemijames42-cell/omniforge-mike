# AI SETUP — ONE TIME, FREE (OPTIONAL, NOT YET INTEGRATED)

**Status October 24, 2026: NO LIVE AI connected.** Do not paste provider keys into this browser app or its exported websites. This file contains the next integration steps, not a switch that instantly activates AI. An authorized provider account, a safe Worker backend, UI adapter work and real inference verification remain necessary.

## Verified public documentation (checked October 24, 2026)

- Cloudflare Workers AI pricing (updated October 1, 2026): https://developers.cloudflare.com/workers-ai/platform/pricing/ — Workers Free includes **10,000 neurons per day** at no charge; the free allocation resets at 00:00 UTC. After reaching the quota, operations fail. Some large models require a paid billing method; do not select them.
- Cloudflare Workers Free plan limits (updated October 12, 2026): https://developers.cloudflare.com/workers/platform/limits/ — **100,000 Worker requests/day** and other CPU/memory limits; free hosting capacity does not imply unlimited free AI.
- Official AI binding walkthrough (updated August 27, 2026): https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/ — `ai.binding = "AI"` and `env.AI.run(...)`, with examples.
- Restricted paid-only model notice (July 28, 2026): https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/ — be careful: not every listed model works with Workers Free. Cloudflare listed `@cf/google/gemma-4-26b-a4b-it` as eligible for the Workers Free plan at that time, but verify in **your account** before using it.

## User/account tasks when you choose to connect

1. Create a **Cloudflare Workers Free** account in your own name. Confirm your account supports Workers AI without requiring billing/upgrade. Do NOT enable Workers Paid or prepaid AI credits. The current public docs describe free neurons, but individual account eligibility must be tested.
2. On a computer/development environment with Node.js and an internet connection, follow Cloudflare's *Get started — Workers and Wrangler* guide. Example official command: `npm create cloudflare@latest -- omniforge-ai` (select Worker-only/TypeScript and decline deployment initially).
3. Add a Worker AI binding to `wrangler.jsonc`: `{ "ai": { "binding": "AI" } }`. The binding runs server-side on `env.AI`. Use the currently eligible Free model documented by Cloudflare; the guide currently shows `@cf/google/gemma-4-26b-a4b-it`. **Never** expose any credential or privileged binding to client source or ZIP exports.
4. **Before public API use**, add authentication/authorization, a verified server-side per-user/day counter (such as a suitably provisioned Durable Object/KV plan if genuinely free eligible for your account), request-size caps, a global consumption circuit breaker and error handling for 403/408/429/503. A client-only counter is not adequate. If you cannot verify durable free storage/counters, keep the endpoint private and disabled.
5. Integrate a validated `/api/ai` response/action parser into OMNIFORGE's typed tool registry. An LLM may only propose validated tool calls; never execute arbitrary text as HTML scripts or shell commands. Ask the user for explicit consent before transmitting photos to any hosted model. Do not silently upload project images.
6. Run a **real, authorized free-model call**, record provider + model + tested date + response/error and verify the quota and billing status. Only after this genuine test should the UI change from **LOCAL / NOT LIVE AI** to **LIVE AI**.
7. Deploy only with your permission, after verifying free eligibility and abuse controls. Record a real public URL only after successful deployment. None exists for this delivered build.

For now, the fully offline/manual OMNIFORGE workspace continues to work independently with **₦0 required fees** and without any provider account. An extra free hosted-model service is **not required** to open, edit or export websites.
