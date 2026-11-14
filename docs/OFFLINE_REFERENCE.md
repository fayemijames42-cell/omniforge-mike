# Offline reference and updates

The existing workspace, supported mathematics and saved project tools can work offline after one complete online visit. The service worker caches the public application shell only; it never caches API replies, owner credentials or private request bodies. Projects and notes live separately in IndexedDB.

Local Knowledge can retrieve a close match from bundled educational topics, user-approved records, imported XML, the public Wikipedia snapshot or a recent lookup. It shows the matching topic and source. Wikipedia cards include the article revision, retrieval date and CC BY-SA licence. User-saved AI replies remain unverified. A comparison can display two distinct saved entries together.

The mode button selects Local Knowledge for subsequent questions. In Cloud AI mode, an unavailable provider or active cooldown can fall back to a matching saved entry for the current question. When a live chat already retrieved usable Wikipedia search excerpts before encountering an AI error, it can show those excerpts directly. Cloud inference, live lookup, saved references and deterministic tools have separate labels. The application leaves an unmatched request visible and reserves cloud generation for connected providers. Arithmetic, symbolic maths, platform identity and saved website recall use local data and code.

Select **Wikipedia lookup** in the composer, or enter `/wiki <public topic>`, to find excerpts outside the saved snapshot. The browser sends only the explicitly entered topic to Wikipedia using its public Action API, with cookies and referrer omitted. Wikipedia's availability and rate limits apply. Each result links to the article revision. The browser retains up to 128 recent article excerpts for offline lookup. Local Knowledge mode answers the same command from saved references.

## Daily public reference snapshot

The public GitHub Actions publisher is scheduled daily at 03:37 UTC (04:37 WAT). It uses one bounded Wikipedia request per UTC day, updating seven core topics and seven rotating topics. The snapshot retains up to 64 entries with per-article provenance. When a request fails, the publisher retains the last usable entries and respects Wikimedia's retry deadline. The job publishes only `snapshot.json` to the `reference-snapshots` branch. Publishing data does not require changing the application or its deployment.

The browser checks on opening, reconnecting and roughly hourly while open. It tries the OMNIFORGE endpoint and can load the published copy directly if the Worker cannot verify it. A release includes 20 attributed introductory excerpts in the offline shell for a fresh device. The browser saves newer validated snapshots atomically and keeps the last saved copy on failure. **Refresh references** checks these sources for a newer publication. Reference downloads carry no chat content, private notes or account keys.

The public snapshot refreshes the inputs to retrieval and comparison. The publish job verifies local retrieval, arithmetic and symbolic maths. Reasoning code changes through reviewed releases. Generated text, automatic website editing and image generation still depend on live model capacity. Saved excerpts are dated and cannot verify breaking events.

Use the **Publish public reference snapshot** workflow's run history and `GET /api/reference-bank` to diagnose refreshes. `delivery` identifies the published or bundled copy. `updatedAt` identifies the last successful update. `attemptedBy` and `attemptedDay` identify the last attempted publication. Inspect individual entries for the original retrieval date. GitHub can delay daily runs and can disable scheduled workflows after 60 days of repository inactivity. A maintainer can re-enable the workflow and run it manually from the default branch.

- [GitHub Actions schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Wikimedia API usage guidelines](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines/en)

Each build fingerprints the JavaScript, CSS and shell. The page and service worker use matching versioned asset URLs. A new offline cache activates only after all required assets are fetched successfully; a failed update leaves the older complete cache available. IndexedDB project data is not deleted by an app update.

Import/export of starter and user records uses XML, with 2 MB and 2,000-entry per-file limits. Public snapshots remain in their attributed cache and can be downloaded again. Browser storage capacity and eviction policies still apply. Export project backups and reference XML when moving to another browser or device.
