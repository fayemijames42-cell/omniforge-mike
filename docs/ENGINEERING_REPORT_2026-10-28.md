# OMNIFORGE engineering report — 28–29 October 2026

OMNIFORGE · Powered by MICHELLE · Owned by ADEN INC.

**Audited release: 0.11.4. Repairs are deployed. Overall acceptance remains PARTIAL because a final genuine text request could not obtain free inference capacity.** This report records both successful observations and failed acceptance checks; a passing build is not presented as proof of all AI behavior.

Repository: `fayemijames42-cell/omniforge-mike`. Starting revision: `1c77b2563126001f2356cfc8664ec45decbbc955`. Latest application revision tested: `dbb49499cd2191328cba5e75f3f96c33b45cbcd7`. Public application: https://omniforge-mike.fayemijames42.workers.dev/

## Result and practical limits

The existing application was repaired without replacing its Worker architecture or user data. Identity, intent classification, active-project context, validated website saving, image persistence, preview isolation and provider error reporting were improved. Obsolete one-shot workflows and duplicate/unused logic were removed. The latest main-branch changes were reviewed and retained.

All **200 Node automated tests pass**, the mobile Chromium integration passes with **13 explicitly simulated provider calls**, and the GitHub build, mobile-browser and Cloudflare deployment checks all succeed. Public health and build metadata match release 0.11.4 and the exact source revision above. The frontend content hash is `0.11.4-3e950f15d150`.

Real earlier Cloudflare text responses created and edited a bakery website and generated syntactically valid Express code. Actual Cloudflare FLUX inference produced decoded, saved and downloaded raster images. On the final 0.11.4 public UI, saved-source project recall, source diagnostics, styled preview, ZIP export and persistence after reload were verified without a model request.

The final independent identity probe at **2026-10-29 19:15 UTC** returned **HTTP 429 / FREE_POOL_WAIT**. Cloudflare reported `daily_budget`; Pollinations and OVH reported `network`; the authenticated alternatives reported missing keys. **Final text acceptance: 0/1, failed due to unavailable free capacity.** The raw result is retained. No paid fallback, allowance increase, counter reset, new account or credential change was used. A provider's public “ready” label is an eligibility estimate, not a promise that a particular request fits its remaining budget.

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
| Styling an existing website could be treated as new creation, omitting its saved source. | “Make the website pink” matched a broad construction expression before edit detection. Website mentions inside backend/image prompts also triggered the builder. | Version 0.11.4 distinguishes construction from styling, passes authoritative source for edits and component additions, and rejects explanatory/negated/nonwebsite requests. Browser fixtures assert the source actually reaches the Worker. |
| Quota errors did not explain which usable services failed. | The frontend discarded bounded provider diagnostics and a short retry hint could be mistaken for a daily reset. | Product-owned provider names and approved reasons now pass through to the UI. The message labels the earliest retry as an estimate and explains that daily allowances reset separately. Raw upstream errors and credentials remain excluded. |


A historical screenshot alone does not prove the exact model output can be reproduced deterministically. For the reported old Express-in-HTML output and SVG substitution, the audit confirmed routing/instruction weaknesses and added deliberately bad-response fixtures; the original stochastic outputs were not re-labelled as newly reproduced live events.


## Architecture and data preservation

The existing Worker remains the HTTP backend; no Express server or frontend framework was introduced. NEXUS prepares instructions, bounded history, calculator evidence and real retrieval. The existing coordinator applies shared, persistent free budgets and fallback rules. All candidate providers receive the same prepared conversation. Vision/transcription are sent only to profiles declaring those capabilities. External APIs still enforce their own limits.

Conversation history remains browser-local: at most 100 stored messages per chat; selected provider context is at most 12 turns and 9,000 characters, retaining bounded early requirements and recent turns. The active document is supplied separately when editing. This is not permanent or account-synchronized memory. Search, rename, deletion, notes and exports remain available. No stored projects, provider counters, encrypted credentials or migration identifiers were deleted or reset.

API-key configuration still requires legitimate free accounts and owner setup. This audit does not create accounts, assume billing status or purchase credits. Owner secrets stay server-side; public status and backups do not contain provider keys. Model tool-calling/JSON-mode features supported by a vendor are not automatically implemented by this application; the active orchestration supplies bounded observed tools rather than an unrestricted model tool loop.


Narrow questions such as “What website did we just create?” now read the actual active document title/name through a local state tool, labelled **LOCAL PROJECT CONTEXT · NO AI**. This works when inference is unavailable. It is not a mock conversational model. Broader discussion still uses model inference with bounded context. The server also supports the same metadata operation without an AI budget reservation and marks it `toolOnly:true`, `live:false`.

## Verification and evidence

| Check | Result | Scope |
| --- | --- | --- |
| Initial baseline suite | PASS: 157 tests | Existing code before this repair sequence. |
| Latest `npm run build` | PASS: 200 tests, zero failures | Includes syntax checks, full Node regression suite and content-versioned asset build. Re-run locally on the latest revision. |
| Current GitHub mobile integration | PASS | Real Chromium, 360 × 780 viewport. Model/image responses are fixtures, not evidence of live inference. |
| Worker bundling | PASS | CI ran Wrangler dry run against the existing bindings; Cloudflare separately deployed successfully. |
| Full npm dependency audit | PASS: zero reported advisories | Includes development tooling. Vendored JSZip and Cloudflare account configuration are outside this advisory scan. |
| Public release metadata | PASS | Health identifies Michelle / OMNIFORGE / ADEN INC.; build manifest matches 0.11.4 and exact source revision. |
| Genuine text/website inference | Earlier live samples succeeded; final request FAILED | Earlier observations are described below; final daily-budget/network failure is preserved, not counted as a chat pass. |
| Genuine raster inference | PASS in 0.11.1 and 0.11.3 observations | Actual Cloudflare FLUX JPEGs, 1024 × 1024, decoded, saved and downloaded. Not re-inferred on 0.11.4. |
| Final local project recall | PASS in public 0.11.4 UI | Actual title “Sunrise Bakery” selected over generic workspace name “Static Code Project”; reply explicitly labelled NO AI. |
| Final source diagnostics | PASS in public 0.11.4 UI | Reported complete document/title, no recognized Node/Express browser code, and correctly flagged absent mobile viewport. No claim of interactive or deployment testing. |
| Final preview, ZIP and reload | PASS in public 0.11.4 UI | Navy body `rgb(3, 5, 91)`, readable black paragraph text; saved project/messages retained after reload. Exported `index.html` exactly equals the earlier 1,078-character AI document. |

The mobile integration covers legacy name preferences after reload, typing feedback, actual frontend-to-Worker edit source, ordinary chat/programming without site replacement, project recall, failed and concurrent saves, incomplete code, failed image requests without placeholders, successful image placement/export, atomic IndexedDB rollback, owner-connection encryption, audio draft review, ZIP/JSON restore, restored CSS/inline JavaScript, image remapping, shared-blob cleanup, network recovery and offline reload. It is a viewport simulation, not a physical performance benchmark on the user's 2 GB Android phone.

### Honest interpretation of live model tests

The first recorded pass used 12 genuine public Cloudflare Llama responses. Its original strict string checks scored **8/12**. Manual review found two checker limitations: the developer answer correctly named ADEN INC. and OMNIFORGE without repeating Michelle, and the website edit preserved the bakery while using navy shade `#03055B` instead of the exact expected keyword/hex. Those raw scores have not been rewritten.

Conversely, the first knowledge checker only excluded 2021 and missed an unsupported 2024 training-date claim. That was a real model defect. A metadata-based self-description guard was added and subsequently verified live in 0.11.2. The bounded guard is not general factual verification.

An early project-recall reply produced HTML. The artifact guard prevented replacement of the saved website, but returning an error was insufficient. A budgeted one-call model-format recovery was added in 0.11.2; recall still could not complete within the remaining allowance. Version 0.11.3 replaced this narrow state lookup with the observed local tool. The final 0.11.4 UI verified the correct answer from saved source without inference.

The targeted 0.11.2 live pass confirmed corrected knowledge-date handling, website creation and exact `#000080` editing. Recall failed and the subsequent research request encountered the daily allowance. These are recorded observations, not a claim that all five checks passed. The initial raw 12-case record and the latest failed request are in `docs/verification/`.

The Express response was checked with Node's syntax parser. The generated backend was not executed, installed or deployed. Live encyclopedia retrieval returned no usable sources; the response did not claim successful browsing or fabricate citations. Current web search remains unconfigured.

The final UI used the earlier genuine AI document as test input in a newly created local static workspace. It was entered through the visible editor; this was **not a new model generation or a successful file-import test**. Unused starter CSS/JavaScript were cleared, source checks reported 1,110 composed characters, and export retained the original `index.html` exactly. The 3,360-byte ZIP contained `project.json`, `index.html`, `styles.css`, `app.js`, `site.html` and `README.txt`; SHA-256 `ccf00dfb28519999aad7326dfa9301ab39ae7a7adcce3bc26ff13bb6fec491e5`. The attempted cloud-browser file chooser did not complete, so it is not counted as a production import pass; local CI import/restore coverage passes.

Two real raster downloads were independently decoded. The latest was **336,110 bytes**, SHA-256 `33c8fc28dee3f5bc82768b23a754b89e983b7c2e85b328fd305b02753dd41a4d`, a 1024 × 1024 JPEG from Cloudflare FLUX. The earlier file was 494,538 bytes, SHA-256 `c73ce19a5d01528c843e47665569a7deff78947f9e5339ce31dcec4601d4d032`. Neither is SVG or a browser fixture. The earlier full UI observation also verified persistence after reload and opening the saved image in Photos.

## Feature status

“WORKING” below names the tested scope; it does not imply every provider or every possible model answer works.

| Feature | Status | Evidence or remaining limit |
| --- | --- | --- |
| Ordinary conversation and programming assistance | PARTIALLY WORKING | Genuine earlier replies and current routing fixtures pass; final real text request was quota/network blocked. |
| Official identity and owner branding | PARTIALLY WORKING | Current UI, health, prompt construction and earlier real replies are correct. Final live identity inference was unavailable, so no latest-model identity pass is claimed. |
| Website creation/editing | PARTIALLY WORKING | Earlier real source generation/edit succeeded. Current classification/source preservation passes regression/mobile tests; full latest live inference sequence remains blocked. |
| Chat preserving an existing website | WORKING in automated/mobile tests | Both action and validated artifact must allow replacement; failed output/persistence/concurrent edits preserve existing work. Latest broad real-model sequence not completed. |
| Active-project title recall | WORKING | Verified in the latest public UI, including reload and exported conversation. Reads local state, not model memory. |
| Static website diagnostics and preview | WORKING | Actual latest UI/source/CSS observation. Diagnostics state their static limits. |
| Browser-local history and project persistence | WORKING within supported limits | Latest production reload plus CI rollback/isolation/restore tests. No account sync or unlimited memory. |
| ZIP/HTML/JSON export and restore | PARTIALLY WORKING in production verification | Latest production ZIP verified; full import/HTML/JSON fidelity verified by browser CI. The attempted latest public file import did not complete. |
| Raster image generation/save/download | WORKING in actual earlier observations | FLUX output decoded and downloaded; latest production inference not repeated. Alternative image providers remain unverified live. |
| Local photo editing and placement | WORKING in mobile fixture integration | Canvas crop/filter/rotation, image metadata/bytes and exports tested; not neural image editing. |
| Photo analysis / audio transcription | NOT CONFIGURED in production | Capability-gated adapters and fixtures exist, but no eligible authenticated vision/speech provider is connected. |
| Provider fallback and quota enforcement | WORKING in deterministic integration tests; PARTIALLY WORKING service availability | Same prepared context survives fallback. Actual anonymous text fallbacks failed to connect. Limits were not bypassed. |
| Local arithmetic and bounded polynomial tools | WORKING in automated tests | Defined mathematical scope; not a general accuracy guarantee or neural model. |
| Notes, conversation search/rename, deletion and backup controls | WORKING in automated/browser tests | Local tools; portability still requires exports. |
| Encyclopedia reference retrieval | PARTIALLY WORKING | Adapter/citation/error tests pass; live probe returned no usable sources. |
| Broader current web retrieval | NOT CONFIGURED | Public `webSearchConfigured:false`. |
| Explicit SVG/vector output | WORKING in automated tests | Kept distinct from raster-model images. No silent substitution. |
| Neural image editing, PDF ingestion, arbitrary server execution, cloud chat sync | NOT WORKING / unsupported | Not added or claimed. Generated server code is not run. |
| Comprehensive primary-to-SS3 syllabus and universal answer quality | NOT TESTED | No complete curriculum corpus or broad evaluation establishes this. |

## Installed provider capability inventory

This inventory describes installed application adapters and observed setup, not fresh verification of all vendor offerings. All use the common bounded app context. Vendor-native tool calling, longer context windows and JSON modes are not automatically implemented.

| Adapter | Installed operations | Actual production setup/verification |
| --- | --- | --- |
| Cloudflare Llama 3.1 8B FP8 | Text/chat/code/websites | Prior genuine responses. Final request unavailable: daily application allowance. |
| Cloudflare FLUX Schnell | Raster images | Genuine 1024 × 1024 JPEG generation/save/download verified. |
| Gemini | Text, vision, transcription | NOT CONFIGURED: missing key. |
| Groq | Text, transcription | NOT CONFIGURED: missing key. Vision is not routed to this adapter. |
| Mistral | Text | NOT CONFIGURED: missing key. |
| Z.ai Flash | Text, dedicated vision model | NOT CONFIGURED: missing key; paid FlashX excluded. |
| OpenRouter free variants | Text | NOT CONFIGURED: missing key; free routing checks retained. |
| LLM7 Turbo | Text through checked catalog | NOT CONFIGURED: missing key. |
| Ollama Cloud | Text | NOT CONFIGURED: missing key; no heavy local phone model. |
| Vercel AI Gateway | Text with confirmation/credit ceiling | NOT CONFIGURED: missing key; no purchased credit enabled. |
| NVIDIA NIM | Development-only text | NOT CONFIGURED: missing key; not production free entitlement. |
| Pollinations Classic text | Anonymous text fallback | NOT WORKING in final request: network failure. |
| OVH anonymous text | Anonymous text fallback | NOT WORKING in final request: network failure. |
| Pollinations Classic image | Raster adapter | NOT TESTED live in this audit; fixtures exist. |
| AI Horde image | Queued raster adapter | NOT TESTED live in this audit; queue/expiry/cancellation fixtures exist. |

The latest public setup still reports `ownerSetup:false`. This audit did not install keys or enroll free accounts. Fifteen profiles are fifteen possible connections, not fifteen simultaneously working models or merged intelligence.

## Security and performance observations

All live checks use synthetic, non-sensitive content on the existing public origin. Visitor/shared rate limits, source-search accounting, refusal handling, fixed endpoints, paid-fallback protections and persistent quota counters remain intact. Generated server-side code is not executed. Generated browser code remains in an iframe with `allow-scripts` and no `allow-same-origin`, with external connections/forms/resources blocked by policy. Raw provider exceptions are not reflected by the public chat handler.

No new runtime dependency ships to the phone. The script/context path no longer repeats full generated HTML through every history turn; summaries and input/output limits bound memory and requests. Image writes are atomic and serial restore behavior remains. The service worker still installs a complete matching shell before activation. Project metadata remains local; clearing browser storage can remove it, so exports remain necessary for portability.


The full current npm audit reports zero advisories after updating compatible Wrangler tooling to 4.155.0 / Undici 7.30.1. This is not a guarantee against all vulnerabilities. Public frontend code and this public repository are inherently viewable; private API credentials and owner configuration are not included in model prompts or client backups. Preview isolation is for sandboxed generated browser code, not execution of arbitrary generated server code.

Current built sizes include approximately 70 KB for `src/app.js`, 19 KB for `src/core.js`, 32 KB CSS and the existing 98 KB JSZip library before compression. No new runtime dependency was added. These measurements are not a complete loading/latency benchmark. Actual model delays and quotas remain external limits.

## Removed obsolete items

The two completed October 25 one-shot live probe workflows were removed, retaining their run logs and commits in GitHub history. The duplicated website-intent fallback and unused coordinator `catalogPrices` map were removed. Useful historical project code, diagnostics, tools and quality records were preserved. Internal infrastructure names containing MIKEE remain intentionally compatible.


## Commits and deployment verification

The three prior user-provided branding commits remain in history, including starting revision `1c77b2563126001f2356cfc8664ec45decbbc955`.

| Revision | Purpose | Verification |
| --- | --- | --- |
| `b8d597710f916f8b3971b8d92ed3e24a3d53382a` | 0.11.1: core identity/intent/context/artifact/persistence/security repair | GitHub checks and Cloudflare succeeded; public version/source matched. |
| `648199735f6e546dc2c1ac0723b46b5bb5ca334b` | 0.11.2: unsupported training-date handling, bounded recovery, image-only placement guard | Checks/deployment passed; targeted live successes and failures recorded above. |
| `cce67922ad46f278a8ee54695c11da52feea81fc` | 0.11.3: reliable local project-state recall | 194 tests/mobile/deployment passed; genuine FLUX output verified. |
| `9ac14646cc3484e57b51ef2b0a750916f4366532` | Styling-edit/source handoff repair | Preserved in merged main history; final 0.11.4 suite covers it. |
| `d1035e2` | Merge website-edit repair | Retained; no prior user data or source discarded. |
| `d4335ff` | Bounded free-provider error diagnostics | Current regression/mobile/build checks pass. |
| `dbb49499cd2191328cba5e75f3f96c33b45cbcd7` | Descriptive raster prompts and accurate retry notice, latest 0.11.4 application code | All 200 tests and three GitHub/deployment checks pass. Public build metadata and final UI verified. |

Latest application Cloudflare build: `5b5bc0a4-1868-42fd-ab90-2c53df0f2225`. Cloudflare version: `4b0a3ab5-24af-4edc-a11b-c8f032360ac7`. GitHub verification run: `40824969788`; build job `123285808137`; mobile job `123285899131`; Cloudflare check `123285986486`. The deployed application is served from the existing Worker, with the existing bindings. This final report/evidence publication does not alter application behavior; the publication commit is available in GitHub history and the public source manifest after its deployment.

## Remaining problems and next verification

1. Free text inference was unavailable on the final check. Repeat the opt-in conversation acceptance after the ordinary allowance reset or an already-authorized eligible connection becomes available. Do not reset counters or enable paid routing to manufacture a pass.
2. Authenticated alternative text/vision/speech connections and broad web search remain unconfigured. No claim of working operations is made for missing credentials.
3. Encyclopedia retrieval and anonymous fallback connectivity need successful actual source/service responses before promotion to fully working status.
4. Full latest production creation → styling edit → ordinary conversation → image sequence remains unverified. `tests/live-browser-acceptance.mjs` is an opt-in candidate check; its existence is not recorded as a successful run.
5. Public file-import verification did not complete in the cloud browser. Deterministic mobile import/restore tests do pass. A minor Files panel project-count label can remain stale until reload after creating projects; source/data persistence was independently verified.
6. Model-generated website quality still needs review. The real sample lacked a mobile viewport declaration, which diagnostics correctly flagged. Static validation does not prove semantic correctness, accessibility, all links or all JavaScript behavior.
7. No comprehensive school syllabus, physical-phone performance study, universal memory, model-weight training, or universal answer-quality benchmark is claimed.

The authorized repairs, regression work and publication are complete. The project is **deployed with verified repairs and documented service/configuration limits**, not declared universally or fully repaired while these acceptance items remain unresolved.

## Files changed across the repair sequence

The list is the cumulative diff from the starting revision through the current application revision, plus this final evidence publication. Historical infrastructure identifiers and stored data remain compatible.

- `.github/workflows/live-acceptance-2026-10-25.yml` — removed obsolete workflow
- `.github/workflows/live-capability-2026-10-25.yml` — removed obsolete workflow
- `README.md`
- `build.mjs`
- `docs/ENGINEERING_REPORT_2026-10-28.md`
- `docs/FREE_POOL.md`
- `docs/MIKEE_QUALITY_GATE.md`
- `docs/verification/michelle-browser-2026-10-28.json`
- `docs/verification/michelle-live-2026-10-28.json`
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
- `tests/live-browser-acceptance.mjs`
- `tests/pool.test.mjs`
- `tests/repair.test.mjs`
- `tests/ui-smoke.mjs`
- `tests/worker.test.mjs`
- `tests/workspace.test.mjs`
- `worker.js`
- `docs/verification/michelle-live-final-2026-10-29.json`
- `docs/verification/michelle-final-observations-2026-10-29.json`
