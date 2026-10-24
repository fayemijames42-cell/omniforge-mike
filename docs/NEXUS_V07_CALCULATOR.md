# OMNIFORGE V0.7 — NEXUS Local Calculator
Budget: ₦0; no new services, keys, or AI calls. Updated 24 October 2026.

## Implemented
- In any MIKEE chat, write `/calc (5+3)*2` or `calculate: sqrt(81)`.
- NEXUS evaluates the expression **in the browser**, adds a labelled local-tool result to the saved conversation, and makes no Cloudflare Workers AI inference request.
- Supports +, -, *, /, %, ^ (power), parentheses, scientific notation, constants `pi` and `e`, functions `sqrt`, `abs`, `sin`, `cos`, `tan`, `ln`, `log` (base 10), `round`, `floor`, `ceil`. Trigonometry is in radians; use `sin(deg(30))` for degrees.
- The `%` operator is remainder (modulo), **not percent**.
- Validated with a small parser; does **not** run arbitrary JavaScript or external code. Non-finite results, unknown functions, too-long expressions, and excessive nesting are rejected.
- Every calculator response declares it is local, so users don't mistake a result for a live AI response. Non-command messages still go to the existing MIKEE model.

## Verification
`npm run check` parses `src/calculator.js`. `npm test` includes `tests/calculator.test.mjs` for arithmetic, precedence, explicit command gating, and invalid input. The Cloudflare build runs both before deployment.

## Manual mobile acceptance (not automatically verified)
1. Open a fresh chat and submit `/calc (5+3)*2`. Confirm 16 and LOCAL CALCULATOR label, with no AI loading.
2. Try `/calc sin(deg(30))` and confirm 0.5.
3. Try `/calc 1/0`; it must show an error, not an invented number.
4. Send a normal question and verify live MIKEE still responds.
5. Confirm a generated website still previews and the previous conversations remain.

## Limitations
- The browser still uses ordinary JavaScript floating-point numbers, so some decimal values are approximations. Not a symbolic algebra/CAS or engineering-grade certified calculator.
- No units, solving equations, graphing or image generation in this release.
- Local projects are not automatically backed up to other devices. Export useful notes and transcripts.
