# OMNIFORGE · MIKEE / NEXUS

OMNIFORGE by ADEN.inc is a conversation-first AI workspace. MIKEE is the assistant; NEXUS prepares context, references and supported tool results. Connected language models generate explanations, writing and code. Website creation is one capability of the assistant.

Public app: https://omniforge-mike.fayemijames42.workers.dev/

## Current implementation — v0.11.0

| Capability | Current behavior |
| --- | --- |
| Conversation | Real inference through the persistent free-service coordinator, with bounded earlier requirements and recent turns. |
| Website creation/editing | Complete HTML accepted into the current project; incomplete output preserves the previous version. |
| Code workspace | Three editable files, actual combined-document preview/export, saved edits and Undo. AI website edits update the same active document. |
| Images | Cloudflare FLUX, Pollinations Classic and queued AI Horde adapters; completed images are saved as local project assets. Availability depends on the provider and its free allowance. |
| Photo tools | Local crop, resize, rotation and image adjustments. Explicit photo analysis needs a connected compatible vision provider. |
| Audio | Transcription adapter for Groq/Gemini; a compatible free account key is required. The user reviews the transcript before sending it. |
| Mathematics | Bounded local arithmetic, polynomial calculus and linear/quadratic equations. Compound arithmetic explanations can use an observed calculator result. |
| References | Keyless Wikipedia REST/Action lookup; optional Tavily for broader/current search. At most two separately budgeted queries and four returned source excerpts. |
| Notes and local knowledge | Local notes, a 36-topic starter reference pack and user-imported XML. Local retrieval is explicitly labelled and is not an offline neural model. |
| Backup | ZIP/JSON restore preserves saved source, current notes/chat, images and image references. Active code files are exported consistently. Undo history is omitted from portable backups. |

A retrieved source is not a verified claim. Citation checks identify source markers actually used by the response; `factChecked` remains false. Provider bindings and successful deployments are also distinct from live inference.

## How the application fits together

- `worker.js`: the single public chat path, input validation, native visitor limits, reference-search accounting and NEXUS synthesis.
- `server/nexus.js`: bounded context, compound-request preparation, observed calculator evidence and artifact/citation checks.
- `server/coordinator.js`: persistent provider reservations, cooldowns, encrypted owner keys and image-job coordination.
- `server/providers.js` and `server/catalog.js`: fixed provider endpoints, approved models and conservative free-service caps.
- `src/core.js`, `src/backup.js`, `src/projectfiles.js`: local saved projects, faithful backups and the actual editable document.
- `build.mjs` and `sw.js`: matching content-versioned assets and an atomic offline-shell update. A failed installation keeps the previous complete cache.

There is no alternate mock chatbot, keyword-based website generator, or second public chat implementation. `/quick-chat` redirects to the main workspace. A website previously saved by the old quick-chat page is imported into the project database once; its original local-storage copy is retained.

## Free-only connections

Cloudflare uses the existing `AI` binding. Anonymous providers may be available without keys; they are best-effort services with their own restrictions. Other installed adapters remain inactive until a legitimate free account is connected and confirmed. Fifteen connection profiles do not mean fifteen active models or combined model weights.

For owner-managed keys, set the Cloudflare Worker secret `MIKEE_ADMIN_TOKEN` to at least 24 random characters. Settings → Connections can generate an owner token. Unlock with that token, then add each provider's key directly to Connections and confirm paid billing/top-ups are disabled. Provider secrets are encrypted server-side, never returned by status responses, and are absent from project backups. Do not commit credentials.

The coordinator stops at its budgets, respects upstream limits and avoids paid fallbacks. Deployment does not reset existing usage or keys. See [connection details](docs/FREE_POOL.md).

## Development and validation

```sh
npm ci
npm run build
npm run deploy
```

The build runs syntax checks and the automated suite before generating `public/`. Browser workflow tests in `tests/ui-smoke.mjs` are optional development tests with explicitly identified model fixtures. They require an installed Playwright/Chromium test environment; no browser dependency is shipped to the phone.

The current audit adds integration coverage for streamed input limits, actual project/code synchronization, backup/restore fidelity, image remapping, safe blob cleanup, update installation, recovery after connection errors and offline reload. Preserve both existing Durable Object bindings and migration tags in `wrangler.jsonc`; they contain accounting state, not obsolete scaffold.

See [audit and acceptance record](docs/INTEGRATION_AUDIT_2026-10-25.md), [offline reference behavior](docs/OFFLINE_REFERENCE.md), and [the public-beta answer-quality gate](docs/MIKEE_QUALITY_GATE.md). Earlier version notes and research documents are historical records, not alternate installation instructions.

## Storage and scope

Conversations, notes, projects and photos live in this browser on this device. Export backups for portability. Clearing browser data can remove them. Local storage is not an account-wide cloud sync system. Saved edits and portable backups preserve the current document; unsaved text in an editor must be saved before exporting.

This release does not claim a complete school syllabus database, universal factual accuracy, arbitrary server-side execution, or that every authenticated provider has been tested. Production acceptance must record actual provider responses separately from deterministic tests and deployment checks.
