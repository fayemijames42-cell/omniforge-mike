# OMNIFORGE v1.0 — Static Code Workspace, ₦0 budget

**Scope:** purely local HTML/CSS/JavaScript file editing, snapshot history and manual ZIP export. This release adds no Workers AI calls, paid dependencies, background agents, account setup, or cloud storage.

## Working components
- In **Files & Backup**, open **Static Code Workspace** and choose New static project or Convert website.
- Three editable source files: `index.html`, `styles.css`, `app.js`.
- Local editor with View diff, Save version, Undo, Preview, and Export code ZIP. Explicit save required.
- Each project stores file text and last 15 snapshots in existing browser IndexedDB.
- ZIP includes those three files and `project.json`, preserving portable import through OMNIFORGE's existing ZIP importer. The export may include existing project images as assets.
- Preview uses a unique-origin sandboxed iframe and a restrictive CSP (default-src none, connect-src none, no forms or frames); CSS and JS are inlined inside this preview, not hosted online.
- Max 160,000 characters per file, 350,000 total, 15 undo snapshots.

## What is not yet completed
- MIKEE automatic patch proposals/review/approval; for now, user manually edits or pastes code.
- Arbitrary file hierarchies, npm build pipelines, TypeScript bundling, live remote network access, shared projects, online cloud backups.
- Reliable account-wide neurons remaining meter. A local count of requests cannot reveal Cloudflare billing usage, caching, or other clients.
- Native PDF.js extraction, local full-text indexed source citations, or advanced AI vector/search APIs.

## Manual Android acceptance
1. In Files, choose New static project, Preview and test the button.
2. Edit styles.css, inspect View diff, Save, Preview, then Undo.
3. Export code ZIP and import through Files & Backup; verify the three files.
4. Test older chats, Notes, image preview, Local Knowledge, calculator, and existing websites.
5. Attempt network requests from the code preview; CSP should block them.

Build scripts enforce JavaScript parse checks and unit tests, but a green Cloudflare build is not proof of every mobile UI interaction.
