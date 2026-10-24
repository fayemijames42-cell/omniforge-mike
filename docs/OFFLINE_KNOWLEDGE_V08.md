# OMNIFORGE v0.8.1: Local Knowledge Fallback

This release uses **two explicitly labeled modes**: Workers AI and Local Knowledge. They are not equivalent AI models.

## What works

- A small **36-topic educational starter XML** is bundled; records are imported into browser IndexedDB. It currently includes foundational electronics, mathematics, computing and a few science topics. It is not an encyclopedia.
- While the page is open and online, the browser checks its packaged XML knowledge roughly **once per hour**. This checks for updated **packaged content**; it does not crawl the internet or teach itself everything. No Workers AI call is made for the check.
- Users can import additional XML packs (max 2 MB and 2,000 entries per file), add reviewed entries manually, or select **Remember** for individual AI replies. Saved AI replies are explicitly labeled unverified.
- Manual Local Knowledge mode retrieves the nearest stored answer without generating new explanations. A failed Cloud AI request due to known quota/network/provider trouble switches to local mode and labels the result honestly.
- A service worker saves the application shell and knowledge pack for **offline reload after a successful online visit**. Version v0.8.1 ensures the `offline-ui.js` script is included, and uses network-first caching for `knowledge.xml` so checks can receive updated packs while online.
- Persistent storage can be requested and knowledge exported/imported as XML for backups. Storage remains **device- and browser-limited**, not unlimited or automatically synchronized.
- Visual theme: graphite/charcoal with understated sage and soft neutral highlights, replacing purple-heavy styling.

## Important limits

1. **XML is a data format, not an AI programming language or intelligence engine.** The offline mode is a keyword-based reference retrieval system. It cannot reason, generalize reliably to arbitrary new questions, or know everything.
2. **Hourly checks run while the app is open.** The mobile browser may pause background tabs; this version cannot promise updates every hour while the app is closed or offline.
3. The cache contains only the **public application shell and published starter pack**. Private chat messages are stored separately in browser IndexedDB, not copied into the public service-worker cache or bulk-ingested into a knowledge store.
4. Free browser storage depends on the browser, device, and origin quota. Clearing site data can delete saved knowledge; export XML regularly. Large imports may become slow or fail.
5. Local answers must disclose their original saved question and source. Imported/user-approved AI-derived answers are **not independently verified**.
6. No paid subscriptions, additional model calls for syncing, background Cloudflare AI inference, or periodic training were added.

## Manual acceptance (pending real-device verification)

1. Open the app online once, permit its service worker installation, switch to **Local knowledge**, ask `What is a diode?`. The answer should be labeled **LOCAL KNOWLEDGE · NO AI**.
2. Open Files & Backup > Knowledge vault; use Import XML or Add trusted knowledge. Ask a matching question in local mode.
3. Turn mobile connectivity off, refresh the already-installed app (subject to browser offline support), and repeat a saved question.
4. Return to Cloud AI. Send an ordinary question and verify Workers AI answers as before.
5. Test the calculator command `/calc (5+3)*2` and website preview as regression checks.
6. Review the Cloudflare build log for the tests. A passing automated build **does not prove** offline reload worked on every mobile browser.
