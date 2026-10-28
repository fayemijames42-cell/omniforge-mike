# OMNIFORGE engineering report — 28 October 2026

OMNIFORGE · Powered by MICHELLE · Owned by ADEN INC.

Release candidate: **0.11.2**. Repository: `fayemijames42-cell/omniforge-mike`. Starting revision: `1c77b2563126001f2356cfc8664ec45decbbc955`.

This report separates reproduced failures, local verification and actual production observations. It is not a claim of universal model accuracy or unlimited free capacity.

## Confirmed failures and repairs

| Confirmed finding | Cause | Repair and regression evidence |
| --- | --- | --- |
| Fresh public app displayed MIKEE; actual live identity answer also said MIKEE despite the three branding commits. | `init()` and Save settings still defaulted to the old name. The backend system instruction explicitly said “MIKEE (also called Aden)” while the newer brief said MICHELLE. | Shared official identity in context/config, consistent backend instructions and visible labels. Old display-name preferences remain stored but cannot override official branding. Mobile reload test covers an existing MIKEE preference; provider request tests cover five identity questions. |
| Owner instructions displayed a secret name that the server did not recognize. | The branding replacement renamed the visible instruction to `MICHELLE_ADMIN_TOKEN` while the configured backend still requires `MIKEE_ADMIN_TOKEN`. | Restore the correct infrastructure name in Settings. Keep all Durable Object names, migrations, vault encryption context, database names and environment-variable identifiers compatible. |
| “Never create a website” classified as creation. Express backend requests classified as normal chat. | Broad keyword matching omitted negation and the Node/Express runtime; duplicated fallback classification could drift. | Shared action classifier rejects negated and explanatory website requests, recognizes explicit programming runtimes, and separates vector and raster requests. Removed duplicate workspace fallback logic. The regression matrix includes the handover's ordinary-chat examples with a website and Create focus already present. |
| Old website context could steer a conversational turn back into HTML. | A general system prompt contained website-output rules on every turn; current source preceded historical creation turns. The existing HTML guard caught only a document at the start of a response. | Task-specific output instructions; current authoritative source follows bounded history and precedes the current request. Block unsolicited HTML/SVG/code fences after preambles too. Both frontend intent and returned artifact must authorize a website save. A Code focus does not turn “How are you?” into an artifact request. |
| Website recall could lack the current saved state. | Full HTML was replaced with a generic history marker, while the frontend sent current source only for edits. New summaries had no artifact metadata for short follow-ups. | Bounded current-project title/headings/name for project recall; no unrelated archive or full HTML for chat. Explicit edits receive the actual current source. Saved website replies retain artifact metadata instead of repeated full HTML. Test raw and compacted history, no-project cases, and identical context through a provider fallback. |
| Website changes were assigned in memory before the storage operation completed. | The success path mutated the active project before awaiting `saveProject()`. Concurrent manual edits could also be replaced by an older in-flight AI response. | Stage a candidate, validate it, check project identity and website snapshot, commit to storage, then activate it. Browser tests force a save failure and make a manual edit during inference; the earlier/newer website remains intact. |
| “Website updated” was an imprecise success stage. | Generated code, local persistence, preview and publication were treated as one success. | Confirm local saving only after the storage commit, invite preview inspection, and state that no live website was published. Local source diagnostics report their exact static scope and make no interactive/deployment claim. |
| Image requests addressed to Michelle could miss the raster route. | The old anchored parser accepted only “please” or MIKEE and lacked natural polite prefixes. | One shared parser accepts Michelle and polite requests. Explicit SVG/vector requests stay separate. A direct chat-API raster request receives a workflow error without invoking a text model or inventing an SVG. The normal UI invokes the actual image endpoint. |
| Image storage could leave a blob without matching project metadata. | File bytes and project metadata were stored separately and in-memory asset lists changed before all writes succeeded. | Save image bytes and project metadata in one IndexedDB transaction; update memory only after commit. Edited copies use the same transaction. Forced-abort browser test verifies unchanged memory/database and no orphan blob. |
| An image provider could return a non-image string labelled as a completed raster result. | The FLUX adapter validated only string length, and the anonymous adapter trusted the declared MIME type. | Verify JPEG/PNG/WebP signatures, retain byte limits, and require browser decoding before local storage. Invalid payload regression returns a visible failure without an image or success claim. |
| Malformed saved HTML could place a script before the preview's CSP insertion point. | The policy was inserted in the supplied head rather than before all untrusted markup. | Prepend the restrictive policy before any supplied markup; preserve original export bytes. Regression covers scripts before the original head. Mobile restore tests still execute the intended inline button while retaining its CSS inside the opaque sandbox. |
| Development dependencies had published vulnerabilities. | Locked Wrangler 4.152.0 included Undici 7.29.1 through Miniflare. | Update the compatible Wrangler 4.x lock to 4.155.0 / Undici 7.30.1. Recheck full dependency audit and bundling. No production dependency was added. |

A historical screenshot alone does not prove the exact model output can be reproduced deterministically. For the reported old Express-in-HTML output and SVG substitution, the audit confirmed routing/instruction weaknesses and added deliberately bad-response fixtures; the original stochastic outputs were not re-labelled as newly reproduced live events.

## Architecture and data preservation

The existing Worker remains the HTTP backend; no Express server or frontend framework was introduced. NEXUS prepares instructions, bounded history, calculator evidence and real retrieval. The existing coordinator applies shared, persistent free budgets and fallback rules. All candidate providers receive the same prepared conversation. Vision/transcription are sent only to profiles declaring those capabilities. External APIs still enforce their own limits.

Conversation history remains browser-local: at most 100 stored messages per chat; selected provider context is at most 12 turns and 9,000 characters, retaining bounded early requirements and recent turns. The active document is supplied separately when editing. This is not permanent or account-synchronized memory. Search, rename, deletion, notes and exports remain available. No stored projects, provider counters, encrypted credentials or migration identifiers were deleted or reset.

API-key configuration still requires legitimate free accounts and owner setup. This audit does not create accounts, assume billing status or purchase credits. Owner secrets stay server-side; public status and backups do not contain provider keys. Model tool-calling/JSON-mode features supported by a vendor are not automatically implemented by this application; the active orchestration supplies bounded observed tools rather than an unrestricted model tool loop.

## Verification performed

- Starting baseline: **157 automated tests passed**; the latest starting revision had successful build, mobile CI and Cloudflare checks.
- Release candidate: **192 automated tests passed**, including new request/identity/context, provider fallback, invalid raster and CSP regressions.
- Real Chromium mobile integration at **360 × 780** uses explicitly labelled provider fixtures. It checks official identity after reload, ordinary chat and programming without site replacement, creation/editing, static diagnostics, failed persistence, concurrent manual edits, incomplete code, image failure/success, atomic image rollback, photo placement, encrypted owner setup, audio draft review, ZIP/JSON fidelity, actual restored inline JavaScript/CSS, shared-image cleanup, network recovery and offline reload.
- `npm run build` runs syntax checks, all Node tests and content-versioned asset generation. A public build manifest reports version, frontend content hash and source commit and is excluded from the service-worker cache.
- Wrangler dry run checks the actual bundle and the unchanged `AI`, asset, rate-limit and SQLite bindings.
- Dependency audit distinguishes production and development tooling. Vendored code and account infrastructure are outside npm's dependency-advisory coverage; zero advisories does not mean absence of all security defects.

## Feature status at candidate preparation

| Feature | Status | Evidence or limitation |
| --- | --- | --- |
| Conversation, identity, website creation/editing | NOT TESTED in production for this candidate yet | 192 local tests and expanded mobile fixtures pass; production acceptance follows deployment. |
| Local diagnostics, persistence, photos, Undo, notes, search, export/restore | WORKING in local browser tests | Static diagnostics expressly do not test every interaction or publish anything. |
| Cloudflare text and image integrations | PARTIALLY WORKING | Both bindings and prior real responses are visible in current production status. Candidate's real acceptance remains pending. |
| Automatic fallback and quota enforcement | WORKING in deterministic integration tests | Same prepared context verified across a failing primary and succeeding fallback. Anonymous fallback availability in production is best effort. |
| Authenticated alternative providers | NOT CONFIGURED | Public live status currently reports missing keys for Gemini, Groq, Mistral, Z.ai, OpenRouter, LLM7, Ollama, Vercel and NVIDIA; owner setup also reports false. |
| Photo analysis and audio transcription | NOT CONFIGURED in production | Adapters/fixtures exist; connected eligible vision/speech provider is required. |
| Arithmetic and bounded polynomial tools | WORKING in local tests | Neither is a general neural model; operations outside supported scope report errors. |
| Encyclopedia research | PARTIALLY WORKING | Keyless Wikipedia adapters and citation handling tested. New live source retrieval is still to be verified. |
| Broader current web search | NOT CONFIGURED | `webSearchConfigured:false`; explicit current verification must report unavailable, not invent current facts. |
| SVG illustration | WORKING in local tests | Explicit vector code remains separately labelled; not raster image-model output. |
| Neural image editing, PDF ingestion, arbitrary server execution, cloud chat sync | NOT WORKING / unsupported | Local photo editing and plaintext/reference-note assistance exist; do not imply these larger features are implemented. |
| Complete primary-to-SS3 syllabus / universal answer accuracy | NOT TESTED | No evidence of a comprehensive curriculum corpus or broad accuracy benchmark. |

## Security and performance observations

All live checks use synthetic, non-sensitive content on the existing public origin. Visitor/shared rate limits, source-search accounting, refusal handling, fixed endpoints, paid-fallback protections and persistent quota counters remain intact. Generated server-side code is not executed. Generated browser code remains in an iframe with `allow-scripts` and no `allow-same-origin`, with external connections/forms/resources blocked by policy. Raw provider exceptions are not reflected by the public chat handler.

No new runtime dependency ships to the phone. The script/context path no longer repeats full generated HTML through every history turn; summaries and input/output limits bound memory and requests. Image writes are atomic and serial restore behavior remains. The service worker still installs a complete matching shell before activation. Project metadata remains local; clearing browser storage can remove it, so exports remain necessary for portability.

## Removed obsolete items

The two completed October 25 one-shot live probe workflows were removed, retaining their run logs and commits in GitHub history. The duplicated website-intent fallback and unused coordinator `catalogPrices` map were removed. Useful historical project code, diagnostics, tools and quality records were preserved. Internal infrastructure names containing MIKEE remain intentionally compatible.

## Deployment and production acceptance

Initial repair commit: `b8d597710f916f8b3971b8d92ed3e24a3d53382a` (0.11.1). Cloudflare build `0652fe0d-e35f-4204-a255-fd7041ec91a4` succeeded, version `22a6d315-3b71-4ed1-b257-a115bfd863be`. Both GitHub build and mobile-browser checks also succeeded. The public health and build manifest matched the intended version and exact commit.

The first real acceptance pass used 12 actual Cloudflare Llama responses. Its original strict string checks recorded 8/12. Manual review found that the developer answer correctly named ADEN INC. and OMNIFORGE without repeating Michelle, and that the website edit preserved the bakery and changed its background to navy shade `#03055B`, rather than the checker's exact keyword/hex alternatives. These are checker limitations, not model failures. Conversely, the original cutoff checker only excluded 2021 and missed an unsupported 2024 claim. The raw results are retained with this correction explicitly documented.

Two substantive model defects remained: an invented training date, and a project-recall question producing website HTML. The HTML guard protected the saved project but a retry prompt to the user was insufficient. Release 0.11.2 adds a metadata-based self-description check and at most one automatic real-model format recovery, charged to the same persistent budgets. Recovery keeps the exact latest request and active-project facts while removing stale artifact instructions, and is constrained by elapsed time and one provider call. Regression tests cover the actual observed date claim and correct, budgeted project-recall recovery.

The research probe retrieved no usable sources and answered from general knowledge without citations. It did not claim successful browsing. Encyclopedia research is therefore **PARTIALLY WORKING / live retrieval unavailable in this observation**, not fully verified. General current-web search is still unconfigured. Remaining model errors and external-service limitations are not hidden by the successful deployment.

The real browser separately generated a flying cow through **Cloudflare FLUX**, decoded and displayed its **1024 × 1024 JPEG**, saved it locally, retained it after reload, opened it in Photos and downloaded the file. The downloaded 494,538-byte JPEG passed image decoding; SHA-256: `c73ce19a5d01528c843e47665569a7deff78947f9e5339ce31dcec4601d4d032`. This was actual raster inference, not an SVG fixture. Old pre-upgrade conversation text was retained unchanged, while current labels switched to MICHELLE.

Corrected release deployment and targeted live acceptance are pending below; the platform is not declared fully repaired while those checks remain outstanding.

`tests/live-acceptance.mjs` is explicit opt-in, uses the existing public free allowances and records actual results. It is not called by the normal build or CI. It checks intended source commit/version before spending model requests, spaces requests, never supplies credentials or changes provider settings, and records failures instead of manufacturing results.

## Files modified in this release

- `.github/workflows/live-acceptance-2026-10-25.yml` (removed obsolete workflow)
- `.github/workflows/live-capability-2026-10-25.yml` (removed obsolete workflow)
- `README.md`
- `build.mjs`
- `docs/ENGINEERING_REPORT_2026-10-28.md`
- `index.html`
- `package-lock.json`
- `package.json`
- `research.js`
- `server/config.js`
- `server/coordinator.js`
- `server/nexus.js`
- `server/providers.js`
- `src/app.js`
- `src/context.js`
- `src/core.js`
- `src/offline-ui.js`
- `src/pool.js`
- `src/projectfiles.js`
- `src/style.css`
- `src/workspace.js`
- `sw.js`
- `tests/live-acceptance.mjs`
- `tests/repair.test.mjs`
- `tests/ui-smoke.mjs`
- `tests/worker.test.mjs`
- `tests/workspace.test.mjs`
- `worker.js`


### Additional repairs found during production acceptance

- Unsupported first-person training-date claims are checked against the fact that no verified cutoff metadata is supplied. The honest unknown-date statement replaces the unsupported clause; useful surrounding explanation is retained. This is a bounded self-description check, not general fact verification.
- Unexpected conversational artifacts get one guarded, quota-accounted model recovery; invalid code still cannot replace a website.
- “Add to this website” is disabled for an image-only conversation until a website actually exists, preventing a false placement-success message.
- Current connection and quality documentation uses MICHELLE; compatible historical filenames and infrastructure identifiers remain unchanged.

Additional evidence and updated current documentation: `docs/FREE_POOL.md`, `docs/MIKEE_QUALITY_GATE.md`, `docs/verification/michelle-live-2026-10-28.json`, `docs/verification/michelle-browser-2026-10-28.json`.
