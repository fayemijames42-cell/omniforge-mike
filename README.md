# OMNIFORGE · MIKEE / NEXUS

**Created by ADEN.inc** — creator credit supplied for the project. This is a branding attribution, not a claim of verified company incorporation or registered trademark.

**Conversation-first, general-purpose AI workspace** running on Cloudflare Workers AI. Website creation is an *optional* capability; a new chat is not automatically a website.

**Deployed Worker:** https://omniforge-mike.fayemijames42.workers.dev/
**Connected source repository:** https://github.com/fayemijames42-cell/omniforge-mike

## Real vs local capabilities

- **Live provider:** MIKEE uses the Workers AI `AI` binding and `@cf/meta/llama-3.1-8b-instruct-fp8`. UI status shows “AI RESPONSE VERIFIED” only after a successful provider response. `/api/health` only checks that the binding exists; it is not an inference test.
- **Local NEXUS routing:** Deterministic task classification gives website requests, explanations, writing and code help suitable response styles with **zero additional model calls**. It is not an autonomous multi-agent system. A manual focus selection takes priority.
- **Conversation library:** Separate saved chats, local topic-based names, rename, search across titles and messages, and Markdown transcript export.
- **Source notes:** Optional short text/Markdown/CSV/JSON excerpts can be included in the next Workers AI request. Nothing is sent automatically merely by attaching them.
- **Local editable Notes:** Each chat can hold up to 20 notes of 16,000 characters each. Save any AI reply using **Save note**, open **Notes**, edit it, save, undo an edit, export .md/.txt. Notes are stored in browser IndexedDB and are not sent to Workers AI unless pasted into a message.
- **Website Studio:** Website-generation prompts may produce full standalone HTML, sandboxed preview, revisions, exports and a limited structured editor.
- **Photo editing:** Local Canvas adjustments; photos remain on device.

## Free-plan engineering rules

Cloudflare Workers AI is not an unlimited free model. Free plan availability and daily neuron limits are determined by Cloudflare (see [official pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)). This code does **not** include a paid provider, automatic upgrade, user-paid services or a paid API key. The public chat endpoint can be used by anyone with its URL, so it should not be described as a protected multi-user product.

- No extra model calls for NEXUS task routing or local note creation. No automatic AI chat-title call.
- Existing website HTML is sent only for recognized editing requests, reducing token usage and limiting unrelated sharing of website content.
- AI requests have capped length, history and output tokens.
- Missing bindings and failed model requests produce errors; rule-based fallback never impersonates a real AI reply.
- Never invent current web search, real-world publication, video or image generation.
- No persistent cloud sync or uploaded files except bounded opt-in reference excerpts.
- **Back up your work.** Browser storage can be lost when the browser/site data is cleared. Use exports before deleting old work.

## Build and tests

Use Node.js 22+:

```bash
npm clean-install
npm run check
npm test
npm run build
```

Deployment is configured via `wrangler.jsonc` with the `AI` and `ASSETS` bindings and `npm run deploy`. A successful GitHub push may trigger Cloudflare Builds for the connected repository.

## What remains unimplemented

Automated browsing, live cited research, cross-device sync, server-side document creation, true PDF extraction, AI image/video generation, autonomous agent actions, and general diagram/engineering simulation tools. Generated websites are not automatically published. The free-tier plan is not guaranteed to support unlimited inference.

See [AI comparison / roadmap](docs/AI_COMPETITOR_BENCHMARK.md) for product lessons and [V0.6 delivery notes](docs/NEXUS_V06_NOTES_AND_ROUTING.md) for verification.

## Verification levels

**Code committed** ≠ **Cloudflare build success** ≠ **live UI tested**. A passing Workers Build runs JavaScript checks and automated tests but does not by itself verify that mobile browser notes/edit/export or inference succeeded on production.

## Mobile workspace navigation (v1.2)

On phones, a top-left menu replaces the crowded bottom tab bar. Chat remains front and centre, while a slide-out workspace menu opens Preview, Edit, Photos, Notes, Files & backups, conversation search and management, Focus and Settings. Escape, close, outside tap and selecting a section dismiss the drawer. Desktop tabs remain as before. No extra Workers AI requests are made for this interface or its existing animated 'MIKEE is thinking…' activity indicator; no private model reasoning is shown.

## V1.3 provisional shared daily AI protection

Every real Workers AI inference is gated twice: existing approximate 60-second per-visitor and per-location burst limits, then a centralized daily request-attempt reservation stored in a SQLite-backed Cloudflare Durable Object. All Cloudflare locations use the same instance per UTC day, preventing simultaneous requests from silently bypassing the shared daily count. Initial guest beta ceilings are **70 chat attempts and 8 FLUX image attempts per UTC day across all visitors combined**. These are conservative *trial* ceilings, **not** measured neuron caps or permanent individual allocations. Limits reset when the UTC day changes; both successful and failed provider calls consume one reservation. Requests rejected for invalid input do not.

The Worker returns HTTP 429 with `dailyLimit: true` and the next UTC reset timestamp when a ceiling is reached, while local tools remain available. If the budget binding/storage is missing or broken, real AI calls fail closed with HTTP 503; there is no unprotected bypass. The public API does not expose private quota management controls. Replies include `provider` and `model` fields; MIKEE's chat displays the model on new replies, while the local calculator remains explicitly labeled local. Provider identity is not evidence of model accuracy. To calibrate, compare counts in the Cloudflare dashboard with *actual Neuron consumption* during a controlled testing day. The request counts do not measure model tokens or Neurons and cannot guarantee that the free allocation is never exceeded. Do not enable paid billing.

This change does not introduce user accounts, synchronized storage, or a security audit. For now, invite a handful of trusted testers, avoid sensitive uploads, and manually export ZIP backups before clearing browser data.
