# OMNIFORGE integration audit — 25 October 2026

## Changes and regression checks

| Finding | Resolution | Evidence |
| --- | --- | --- |
| Two chat frontends and two different backend prompt/history paths | Removed the standalone quick-chat UI and secondary public chat handler; main NEXUS chat is authoritative. Old quick-chat websites migrate locally without deleting their original copy. | Main Worker/provider integration suite; redirect and migration paths. |
| Mock mode and a keyword-based website generator remained alongside live MIKEE | Removed the switch, mock send path, rule interpreter and generated business templates. Existing structured projects still render and edit. | Core regression suite and mobile workflow. |
| Restoring a backup stripped its CSS/JavaScript | Imports preserve saved source; previews run inside the existing opaque iframe sandbox with an injected restrictive policy. | ZIP and JSON round trips; restored button executes and navy CSS remains applied. |
| Image messages kept old asset IDs after restore | Remap conversation images, website references and code-file references to the new imported IDs. | Browser restore checks verify new IDs and actual stored image blobs. |
| Code files, website HTML, preview and export could disagree | One active document is used for AI editing, image placement, preview and exports. Undo restores the prior code content and chat/artifact state. | Code synchronization tests and browser image placement/export. |
| The Edit button could replace real generated HTML with a starter | It now opens the actual code editor while preserving the document. | Browser conversion and round-trip workflow. |
| Saved images could be left behind when deleting a project | Transactionally remove only blobs not referenced by another saved project. Roll back newly created blobs if an import fails. | Shared-blob deletion test and failed-import test. |
| Import/export could decompress or retain unnecessary large history | Bound ZIP entry reads, restore one image at a time and omit Undo history from portable backups. Missing image data causes an explicit failure. | Entry limits and browser backup tests. |
| Audio lacked the chat visitor limiter | Apply the same native safeguards before processing transcription uploads. | API regression test. |
| Oversized requests were read into memory before checking actual length | Use a bounded streaming body reader for chat and images. | Stream cancellation test without trusting Content-Length. |
| Status reset times could disagree with the limiter | Report actual spacing/minute waits and monthly budget reset times; too-large requests give a size error rather than an endless retry. | Coordinator tests. |
| Deployment could combine a new page with old cached scripts | Content-versioned module URLs and matching offline cache; activate only after a complete cache installation. | Atomic-install tests and actual offline browser reload. |

The existing SQLite object names, storage keys and Cloudflare migration tags are preserved. No provider counters are reset. No new paid service or runtime dependency was introduced. Historical project data is retained; new chats begin with an empty document instead of a fabricated template.

## Local acceptance

- 151 automated tests passed.
- Mobile browser workflow passed with explicit provider fixtures: creation/editing, incomplete output preservation, unrelated HTML kept in chat, generated-image placement/export, encrypted owner connection, audio drafts, ZIP/JSON restore, restored JavaScript and CSS, remapped images, shared-blob cleanup, connection-error recovery and offline reload.
- Wrangler deployment dry run passed with both existing SQLite bindings, native rate limiters, AI and asset bindings.
- The actual workerd runtime is checked separately from the Node fixture suite.

Fixture tests establish application behavior, not the quality or availability of all connected models.

## Production acceptance

Before this cleanup, the public app was opened in a real browser and returned a live Cloudflare Llama response, including the observed calculator value 432. It also generated a complete 1,268-character PaperNest website and downloaded its actual ZIP backup. Those results established that the earlier public deployment was capable of real inference and creation; a green build alone was not used as proof.

Post-deployment acceptance for this cleanup is recorded after publishing and testing the same public origin. Authenticated providers without supplied keys cannot be independently exercised by this audit. Broader factual accuracy and full syllabus coverage remain outside these limited acceptance checks.
