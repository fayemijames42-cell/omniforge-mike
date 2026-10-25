# Offline reference and updates

The existing workspace, supported mathematics and saved project tools can work offline after one complete online visit. The service worker caches the public application shell only; it never caches API replies, owner credentials or private request bodies. Projects and notes live separately in IndexedDB.

The bundled XML starter contains 36 basic educational topics. Local Knowledge retrieves a stored reference answer and shows its original question and source. It is not a neural model, automatic learning system or complete curriculum. User-saved AI replies remain explicitly unverified.

The mode button selects Local Knowledge deliberately. A temporary AI/network error does not silently change that saved preference. When the browser itself is offline, text questions can use local reference retrieval for that request; returning online permits Cloud AI again. Arithmetic and the supported symbolic tools execute locally without inference.

The bundled knowledge file is checked on opening and roughly hourly while the page is running. This only checks the deployed static pack. It does not crawl or train from the Internet and is not guaranteed to run while the phone suspends the page.

Each build fingerprints the JavaScript, CSS and shell. The page and service worker use matching versioned asset URLs. A new offline cache activates only after all required assets are fetched successfully; a failed update leaves the older complete cache available. IndexedDB project data is not deleted by an app update.

Import/export of knowledge uses XML, with 2 MB and 2,000-entry per-file limits. Browser storage capacity and eviction policies still apply. Export project backups and reference XML when moving to another browser or device.
