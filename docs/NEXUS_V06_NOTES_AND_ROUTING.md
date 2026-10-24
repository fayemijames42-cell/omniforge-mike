# OMNIFORGE V0.6 — local NEXUS routing + reusable Notes
Updated: 24 October 2026 | ₦0 budget | Production repo: `fayemijames42-cell/omniforge-mike`

## Scope
Build only capabilities that work within current resources, without new accounts or paid services.

### 1. Local NEXUS routing
- New pure module: `src/workspace.js`.
- Classifies a message as general conversation, learning, writing, code help, creative planning, website generation or contextual website editing.
- User-selected focus overrides inferred response style.
- Visible provenance on outgoing user messages: “Local NEXUS routing; no extra AI call.”
- Only send existing website HTML when the user appears to request an edit; ordinary chat in a website project does not automatically transmit its HTML.
- This is **classification/routing**, not a real tool-using AI agent. No arbitrary shell, no external account access.

### 2. Notes as local artifacts
- A separate **Notes** tab on desktop/mobile.
- “Save note” action on AI responses, plus blank note creation.
- Note title/body editor, explicit Save, revision history (last 12 saves), Undo, preview and Markdown/text export.
- Up to 20 notes per conversation, 16,000 body characters per note. Stored in the existing local IndexedDB project record, separate from HTML website state. No inference or cloud storage is used.
- JSON conversation/project export includes saved notes. Files and photos remain local.
- An unsaved note is visibly marked; save before changing chats or views.

### 3. Regression and limits
- `tests/workspace.test.mjs` checks title/export utilities, local note data lifecycle, limits and router behavior.
- `npm run check` and `npm test` run before the Cloudflare build creates static assets.
- No changes to Workers AI provider or pricing configuration.
- No claim of live search, unimplemented file support, public publishing or artificial multi-agent behavior.

## Manual acceptance (do not mark complete without observation)
1. Open a new conversation and ask an electronics question. Verify a “Learning and explanation” route on the outgoing message and a normal MIKEE answer.
2. Choose **Save note** under that reply, navigate to **Notes**, edit and Save, refresh the browser, confirm the note is still present.
3. Undo the edit and export the note as Markdown and text; inspect the downloaded files.
4. Switch chats and verify notes do not leak into another chat.
5. Ask for a new website, inspect Preview. Ask for an edit such as “Change the hero section”; confirm the edit modifies the existing HTML rather than starting a new site.
6. Check the Cloudflare production build for successful check/test/deploy; note that simulated AI tests do **not** prove live inference.

## Honest limitations
- Explicit Save is required for note edits (they are **not autosaved**). A browser reload before Save loses that draft.
- Notes do not have WYSIWYG formatting or AI document generation, and no external account sync.
- NEXUS is a deterministic keyword classifier; it can misinterpret ambiguous requests. A focus selector and ordinary chat remain available.
- The website context classifier intentionally favors avoiding unnecessary data/token use; some indirect follow-up edits may need explicit reference to the page/site.
- No payment integrations, OAuth credentials, browser automation or server-side execution were added.
