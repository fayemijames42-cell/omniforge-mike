# OMNIFORGE v0.3 Local MVP — QA report
Date: 2026-10-24. This is a local/manual standalone fallback to the requested React/Vite MVP, **not a completed full-spec product**.

## Build and install — actual results

| Command / attempt | Actual result |
|---|---|
| `npm install --package-lock-only --no-audit --no-fund` in original React/Vite source | BLOCKED/TIMED OUT after 180 seconds: npm registry DNS/network access unavailable; original React production build was **NOT RUN**. |
| `npm install --package-lock-only --offline` in zero-dependency local fallback | PASS (exit code 0). Generated lockfile. |
| `npm run check` (Node syntax check of core/UI scripts) | PASS (exit code 0). |
| `npm run build` (zero-dependency standalone packaging) | PASS (exit code 0). Self-contained ~163 KiB HTML. |
| React TypeScript (`tsc -b`) and Vite production build | **NOT RUN / BLOCKED** (packages could not be fetched). The provided working fallback is not React/Vite and is labeled accordingly. |

## Function / browser acceptance tests

The environment's managed Chromium refused navigation to both `localhost` and `file://` with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Rather than inventing browser results, real Chromium was exercised using **`page.set_content()` with a clearly marked *test-only in-memory IndexedDB shim***. These are valid interactive browser/layout tests but **do not verify real browser IndexedDB persistence, real-origin reloads or a hosted deployment**. Exports were also opened via `set_content()` in a separate browser page with no resource network requests.

| Test | Result | Evidence / limitation |
|---|---|---|
| First mobile screen and chat creation | PASS (in test harness) | Created creative learning academy; resulting site has Home/Programmes pages; no console/page exceptions. |
| Second unrelated site | PASS | Created perfume storefront with a different section hierarchy/content/style. |
| Same-site follow-up | PASS | “Make the headings larger and add a contact page”: heading scale changed and Contact page added; undo returned to previous two pages. |
| Multiple projects / selection | PASS | Two projects retained in in-memory test shim and shown in selector. |
| Persistence after app reinitialization | PARTIAL | Project, images and gallery survive DOM/UI reinitialization using in-memory fake IndexedDB. Real-origin IndexedDB reload **NOT VERIFIED**. |
| Mobile widths 320, 360, 390 and desktop 1280 | PASS | No horizontal document overflow in automated browser visual test; screenshots generated. |
| Photos | PASS | Added two distinct image files, adjusted brightness/crop/rotation on one, saved edited derivative (original retained), linked 2 photos to correct project's gallery. |
| Offline single HTML with image embedding | PASS | Both embedded images decoded successfully and internal page hash navigation switched visible pages, including in a page where network requests were blocked. |
| Project ZIP export/import | PASS | ZIP included project JSON, `site.html`, and 3 distinct binary photo files; ZIP import made a second project with 3 assets. |
| Runtime argument validation | PASS | Malformed `update_website` tool argument rejected. |
| Malicious HTML input | PASS for tested payload | Script, remote tracking `<img>`, `javascript:` link, inline style and event-handler attributes stripped by sanitizer. This is not a security audit. |
| Oversize image import | CODE GUARD | 8 MB size and 20 MP dimensions checked in code; an actual oversized file/browser storage-exhaustion failure was NOT RUN. |
| Hosted provider / real model response / vision / AI images | NOT RUN | No account, secret, binding or tested provider call. |
| Simulations, arbitrary documents, collaborative work | NOT IMPLEMENTED | Not claimed. |

## Work delivered and honest limitations

**WORKING LOCAL FALLBACK:** conversation-first mobile shell, project choice, messages, mock honesty, generic deterministic site composition, guided manual multi-page editor, preview sandbox, undo, photo edits and handoff, project ZIP/JSON, standalone HTML, local IndexedDB code and browser screenshots. Mobile rendering and interactions were browser-tested via a shim because managed navigation was blocked.

**NOT COMPLETED:** a compiled React/TypeScript/Vite refactor; real browser persistence verification; live/cloud AI integration; verified deployment; multimodal AI; arbitrary advanced simulations and general-purpose document intelligence. The input React ZIP is preserved untouched. Manual/rule-based output may be limited compared with true AI.

**Security caveats:** offline project imports and exported HTML should be reviewed before any public hosting; input validation covers common vectors but no penetration testing was undertaken. ZIP decompression checks are best effort. Clearing site data can erase local project/assets. Export backups regularly.

## Test material

- `samples/390-mobile-preview.png`, `samples/390-storefront.png`, `samples/390-photo-editor.png`, `samples/390-gallery.png` — screenshots generated from Chromium with the test-only persistence shim.
- `samples/layout-320.png`, `layout-360.png`, `layout-390.png`, `layout-1280.png` — responsive screenshots.
- `samples/offline-portfolio-with-photos.html` — generated single-file HTML with two embedded photos.
- `samples/offline-portfolio-backup.zip` — exported/imported project ZIP.

## Follow-up development priorities

1. Build the product in the original React/Vite repo with a working dependency registry, and run TypeScript + Vite checks.
2. Repeat browser tests on a real HTTP/HTTPS origin with native IndexedDB, 2 GB Android memory profiling, refresh, network offline, quota exhaustion and backup restore tests.
3. Only after stable 1–2: integrate Cloudflare Workers Free eligibility and a rate-limited backend with a live verified model call and explicit account authorization. See `AI_SETUP_FREE.md`.
