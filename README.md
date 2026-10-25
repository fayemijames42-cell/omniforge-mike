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

## v1.4: locally verified mathematics

MIKEE routes explicit calculus/equation requests to NEXUS's deterministic polynomial mathematics without requesting a Cloudflare AI inference. Examples: `Differentiate 3x^3 + 5x^2 - 7x + 2`, `Integrate x^2`, `Solve x^2 - 5x + 6 = 0`. The local result includes rules and limited per-term steps, plus a visible `NEXUS · LOCAL SYMBOLIC MATH` label. No model inference, live search, or simulated free-form general reasoning is involved. It supports variable x, bounded polynomial expressions (and x^-1), plus linear/quadratic real equation solving; unsupported transcendental functions, multivariable expressions and higher-degree equations produce an explicit unsupported message instead of an invented answer. A dedicated test suite exercises supported and unsafe cases. The module is packaged into the PWA shell for offline use; use an explicit natural-language maths request, or `/math differentiate x^2` or `/math solve 2x+3=11`.

## v1.5 — deliberate retrieval-backed research (partial internet access)

The existing Workers AI chat endpoint now understands explicit requests such as `Search the web for how solar cells work` or `Find online sources about diode circuits`. It retrieves up to four source snippets from Wikimedia's public encyclopedia search (requires no credentials) and includes their HTTPS source links and retrieval time in the answer. Source snippets are untrusted data; MIKEE must label unsupported claims and must not treat them as independently verified facts. Research uses one ordinary Workers AI inference after retrieval—not one inference per result—and a distinct server-side daily budget of 24 research attempts to protect public source APIs.

**Optional general web search for current events:** Create a **free** Tavily Researcher account (currently 1,000 credits per month with no credit card required); store the key as the Cloudflare Worker secret `TAVILY_API_KEY` via `npx wrangler secret put TAVILY_API_KEY`. The key must NEVER be put in browser code. No secret is set by this commit. Once connected, the backend can query broad web results from Tavily at most once per research request. The app does not make a paid API request automatically, and no external search provider is activated without a key. When a user requests current/breaking information before general web search is configured, MIKEE explicitly reports it cannot verify that material rather than hallucinating it. This is NOT unrestricted browsing, a full crawler, search-engine indexing, automatic fact checking, or a daily model-training service.

Responses now include `research` and a bounded `sources` array when evidence was retrieved. The conversation displays clickable URLs under the response. They may help users check claims themselves, but search snippets alone cannot guarantee the claims are verified. Privacy: queries for research are sent to the search provider (Wikipedia; Tavily when configured). Users should not send sensitive details for research.

### Web research testing (v1.5)

The new `tests/research.test.mjs` verifies fixed-host Wikimedia retrieval, mocked optional Tavily queries, HTTPS source filtering, no model call when current search is unavailable, and a single Workers AI invocation for source-grounded answers. Mocked tests do not use external search credits or Cloudflare Neurons. Test first with `Search the web for photosynthesis`; the result should include Wikipedia source links. General web search for changing information needs the optional Tavily free API key. Wikipedia reference lookup alone is not full internet browsing or independent fact verification.

## v1.6: automatic intent recognition and source lookup

MIKEE no longer requires the user to type `search the web` for a high-confidence factual lookup. The worker first uses a **bounded, deterministic** classifier to decide whether the request is a creative task, mathematics, conversation, a stable factual question, or a time-sensitive question. Only selected stable factual questions (for example `What is a diode?`, `Explain how solar panels work`, `Who invented the transistor?`) automatically retrieve keyless Wikipedia result excerpts. The local classifier does **not** call an additional model, so only the ordinary response uses Neurons. It does not transmit personal questions to the external search provider by default. Explicit source searches still work as before.

Known limits: An encyclopedic snippet does not establish truth; new information from multiple authoritative sites is not available until an optional general-web search provider has been configured. For current facts with no general-web provider, MIKEE may give stable background but is instructed not to invent current answers; the reply visibly says it was *not verified online*. Automatic lookup errors or exhaustion of the small daily research budget also show that warning rather than silently claiming web research. Explicit requests for live research or sources fail visibly when unable to retrieve them. Research returns zero to four links and retrieval timestamps when actually available. The model still makes mistakes; users should verify consequential information.

The change is intentionally small: a deterministic routing rule is **not** equivalent to model reasoning, understanding everything, complete web browsing, or independently verifying every source. There is still no account synchronization or paid search API. The Worker remains on the same free hosting plan and per-day AI limits.
