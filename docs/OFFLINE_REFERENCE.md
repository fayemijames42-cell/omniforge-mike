# Offline reference and updates

The existing workspace, supported mathematics and saved project tools can work offline after one complete online visit. The service worker caches the public application shell only; it never caches API replies, owner credentials or private request bodies. Projects and notes live separately in IndexedDB.

Local Knowledge can retrieve a close match from the bundled educational topics, user-approved records, imported XML or the most recent public Wikipedia snapshot. It shows the matching topic and source. Wikipedia cards include the article revision, retrieval date and CC BY-SA licence. User-saved AI replies remain unverified. A simple compare request can display two distinct saved entries side by side.

The mode button selects Local Knowledge for subsequent questions. In Cloud AI mode, an unavailable provider or active cooldown can fall back to a matching saved entry for the current question. When a live chat already retrieved usable Wikipedia search excerpts before encountering an AI error, it can show those excerpts directly. Cloud inference, live lookup, saved references and deterministic tools have separate labels. The application leaves an unmatched request visible and reserves cloud generation for connected providers. Arithmetic, symbolic maths, platform identity and saved website recall use local data and code.

## Daily public reference snapshot

The Worker is scheduled for 02:15 UTC (03:15 WAT) daily. The first download can initialize a new snapshot before the first scheduled run. A dedicated instance of the existing SQLite-backed Durable Object reserves one update attempt per UTC date, with a single fixed Wikipedia Action API call for eight selected topics. Topics include education, technology and a small rotation of public reference articles. The server retains the latest successful records, up to 64, including per-article provenance. Failed fetches, invalid data and rate-limit responses preserve the last usable copy.

The browser checks on opening, reconnecting and roughly hourly while open, with a short backoff on a failed download. It saves each newer validated snapshot atomically and retains it for offline use. Downloads send no chat content, private notes or account keys. The browser's **Refresh references** button retries the download from OMNIFORGE. It does not trigger a new Wikipedia crawl.

The public snapshot is bounded by storage and source permissions. It refreshes the information available to retrieval and comparison. The reasoning code changes through reviewed releases. Model training and neural inference still require a model and compute. Current or breaking factual requests require an appropriate live source.

Cloudflare scheduling uses UTC and configuration changes can take time to propagate. For local testing run `npx wrangler dev --test-scheduled`, invoke the local schedule endpoint, and inspect `GET /api/reference-bank`. In production use the returned `attemptedBy`, `attemptedDay` and `updatedAt` to distinguish first-download initialization from a successful scheduled update. The dates on individual entries identify when each excerpt was retrieved.

- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Wikimedia API usage guidelines](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines/en)

Each build fingerprints the JavaScript, CSS and shell. The page and service worker use matching versioned asset URLs. A new offline cache activates only after all required assets are fetched successfully; a failed update leaves the older complete cache available. IndexedDB project data is not deleted by an app update.

Import/export of starter and user records uses XML, with 2 MB and 2,000-entry per-file limits. Public snapshots remain in their attributed cache and can be downloaded again. Browser storage capacity and eviction policies still apply. Export project backups and reference XML when moving to another browser or device.
