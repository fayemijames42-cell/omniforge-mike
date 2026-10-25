# Verification record — 25 October 2026

## Direct live provider check

- Endpoint: `POST https://text.pollinations.ai/openai`.
- Authentication: none; no wallet, payment or purchased credits.
- Test prompt: `Answer in one short sentence: what is 19 plus 28?`
- HTTP status: `200`.
- Reported model: `gpt-oss-20b`.
- Returned answer: `19 plus 28 equals 47.`
- Reported usage: 322 prompt tokens, 67 completion tokens, 389 total.
- Reported user tier: `anonymous`.

This establishes that this public API responded to an actual inference request from the research/development environment. Cloudflare egress can have different shared-IP limits. It does not verify every installed adapter or production deployment.

## Automated checks

The original core checks and backend tests run with explicitly identified fixtures. Fixture responses are not live-model verification. They verify application behavior for successful routing, quota fallback, cooldowns, persistence across coordinator restarts, concurrent reservations, malformed input, owner authentication, encrypted keys, paid-model rejection, free eligibility checks, image queues, and audio transcription.

The build and Wrangler dry run validate the deployed asset layout, module bundle, `AI`, `ASSETS`, and SQLite-backed `MIKEE_POOL` binding/migration. Authenticated providers still need their owner's free account access and a real response test.

## Completed application validation

- 33 backend tests passed, along with the original core checks and JavaScript syntax checks.
- A 360 × 780 browser smoke test passed against the actual application with explicit provider fixtures: typing feedback, repeated edits to the same site, preservation after incomplete HTML, generated-image storage/placement/embedding, owner-key encryption and audio transcript drafts. Browser fixtures do not verify model quality.
- The actual workerd runtime loaded the SQLite-backed coordinator, returned all 14 connection profiles, and correctly stopped an unconnected Groq request without calling a remote model.
- The Worker/asset bundle passed Wrangler deployment dry run. Production deployment and authenticated provider access are separate checks.

## Final merge validation

The connected deployment repository is `fayemijames42-cell/omniforge-mike`. Its newer features and concurrent research/source-citation fixes are preserved. Final validation: 101 automated tests; mobile browser workflow with explicit model fixtures; actual workerd with both the existing DailyBudget and new MikeeCoordinator SQLite objects, all 15 connection profiles and native visitor burst limits. No remote model was called during the runtime binding check.
