# OMNIFORGE · MIKEE

Your existing OMNIFORGE workspace connected to Cloudflare Workers AI. Reuses the OMNIFORGE Local Source and MIKEE Worker Starter; does not discard existing projects or editing tools.

[Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Ffayemijames42-cell%2Fomniforge-mikee)

## Deploy
Use your existing Cloudflare account and Workers Free plan. The button imports this repository and configures the AI binding from `wrangler.jsonc`. Cloudflare may ask to create a repository copy and choose an unused Worker name. If you want to update your existing `omniforge-mikee` Worker instead, connect this repository through that Worker's Settings → Builds. Build command: `npm run build`. Deploy command: `npm run deploy`. No API key belongs in this repository.

Do not upgrade to a paid plan for this milestone. Cloudflare Workers AI provides 10,000 neurons/day on Free; requests stop at the allowance. This public preview has a public chat endpoint: anyone with the address can consume the shared allowance. It is not a production multi-user service.

## Verify the real AI
Open the deployed address and ask MIKEE an original question. The app only displays “AI RESPONSE VERIFIED” after a successful provider response. `/api/health` confirms configuration only; it does not verify inference. `/api/chat` accepts POST JSON `{ "message": "your question" }`. `/quick-chat` preserves the original starter chat UI.

**Status at source publication:** local tests passed using an explicitly stubbed AI binding. No live inference or Cloudflare deployment has been verified yet.

## What is connected
- Natural-language conversation through `@cf/meta/llama-3.1-8b-instruct-fp8`.
- Full HTML website generation, preview, follow-up editing, undo and HTML/ZIP export.
- Existing IndexedDB project library, local photo editing and structured starter editor.
- Explicit local rule-based mode in Settings. AI failures never fall back to fake responses.

## Current limits
AI-generated HTML is edited through chat; the structured section editor cannot directly edit arbitrary HTML. Automatic photo placement into AI HTML is not yet connected. Photo tools remain local; generated previews are isolated in a sandbox. Project imports sanitize HTML and may remove scripts/styles. Image generation, server-side execution, automatic publication of generated sites, engineering simulation tools and a complete general-purpose agent are not implemented.

Prompts, recent conversation and website text are sent to Workers AI. Projects/photos remain in your browser; export ZIP backups. A new deployment address has separate browser storage, so import a backup if needed. AI editing is limited to 24,000 HTML characters per request; replies can be truncated, in which case the previous website is preserved.

## Development
Node 22+, `npm install`, `npm run check`, `npm test`, `npm run build`. `npm run deploy` requires Cloudflare authorization. AI binding name: `AI`; static assets binding: `ASSETS`.

Cloudflare documentation: [deployment buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/), [free allowance](https://developers.cloudflare.com/workers-ai/platform/pricing/), [model](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/).
