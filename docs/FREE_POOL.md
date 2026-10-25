# MIKEE free-service foundation

## Adapter matrix

| Connection | Capabilities | Activation / constraints |
| --- | --- | --- |
| Existing Cloudflare Workers AI | Chat, website generation/editing | Existing `AI` binding; conservative app budget on Workers Free |
| Cloudflare FLUX | Image generation | Existing AI binding, four steps, separate per-provider cap |
| Gemini | Chat, websites, photo analysis, audio transcription | Free-tier key and confirmation |
| Groq | Chat, websites, Whisper transcription | Free Plan key and confirmation; per-minute token ceilings can rule out a large site |
| Mistral | Chat, websites | Studio Free mode key and confirmation |
| Z.ai | Chat, websites, photo analysis | Standard API key; only the listed free Flash models |
| OpenRouter | Chat, websites | Key; approved `:free` variant or free router; no paid model fallback |
| LLM7 | Chat, websites | Free token; live catalog must identify a TURBO chat model |
| Ollama Cloud | Chat, websites | Free starter-model access; no local download; paid credits disabled |
| Vercel AI Gateway | Chat, websites | Confirmed unbilled free-tier account; approved model and runtime pricing check |
| NVIDIA NIM | Development chat / coding | Prototyping key; `MIKEE_DEVELOPMENT_ONLY=true` |
| Pollinations Classic | Chat, websites | Anonymous; at least 31 seconds between app requests |
| OVHcloud Anonymous | Chat, websites | Anonymous testing endpoint; at least 31 seconds between app requests |
| Pollinations Classic Images | Image generation | Anonymous; at least 46 seconds apart; provider logo preserved |
| AI Horde Images | Queued image generation | Anonymous volunteer workers; cancellable job, ten-minute application deadline |

SiliconFlow, ModelScope and Scaleway remain outside the active pool until their relevant free account/model conditions are verified. Puter's individual user-pays account model is also outside the shared pool. Paid providers and expiring purchase-dependent trials are not added just to make the list longer.

The provider catalog is in `server/catalog.js`. Its local budgets deliberately sit below known public quotas where possible. The owner may lower them but cannot raise them above the code's ceilings. Reservations include the whole accepted website, compact history, chat framing and the maximum generated output. Failed/uncertain attempts retain their reservation. Credentials and model changes do not reset usage.

The global application ceiling is 400 AI tasks per UTC day. Provider token/request day budgets use UTC; upstream daily, rolling or monthly limits still take precedence. A local reset cannot restore an exhausted provider allowance. Existing history is compacted, while accepted current HTML is kept whole. A document above 24,000 characters is rejected instead of silently truncated.

Vercel's public live catalog supplies USD/token prices but does not publish a free-eligibility field. The owner must confirm an unbilled Free-tier account; the provider enforces which models that account can access. The adapter checks the model allowlist and current prices before reserving credit cost. Missing or ambiguous pricing stops the adapter. Its application credit reservation ceiling is $4 per UTC month, below the advertised $5 free credit, but the provider's own credit period and balance remain authoritative. Never connect a purchased-credit or automatically funded account to this free pool.

## Unified workspace behavior

Chat and website work share the existing conversation. Use Create → Generate an image or `/image ...` for image generation. The resulting image is saved with the project. In Photos, choose Add to this website to place it; exports embed its local bytes. Internal `omniforge-asset://...` references keep those bytes out of later text prompts.

Choose Analyse photo explicitly to send a resized JPEG to a vision model. Uploaded photos otherwise remain local. Use Audio to upload a short recording under 2 MB; review its transcript before sending. These are real external operations once a corresponding service is connected, rather than claims made by a text model.

Response details identify the serving model. Connections shows installed, configured, waiting and last-successful states. Queue acceptance is never reported as a generated image or successful inference.

## API routes

- `GET /api/health`: bindings/configuration only, always `verified:false`.
- `GET /api/providers`: safe connection states; no credentials.
- `POST /api/chat`: `{message, history?, currentHtml?, image?, provider?:"auto"}`.
- `POST /api/image`: `{prompt, provider?:"auto"}`; returns image bytes or a queued job.
- `GET /api/image/:jobId`: status; `DELETE` cancels.
- `POST /api/transcribe`: multipart `file`, optional `provider`.
- `GET|PUT /api/admin/providers`: owner Bearer token required.

Connections and generated results remain on the existing Worker origin. API keys never appear in URLs. Request bodies have size limits; the browser preview stays sandboxed. Provider endpoints are fixed in code, and the client cannot choose arbitrary outbound URLs.

## Merge into the connected deployment repository

This update builds on `fayemijames42-cell/omniforge-mike`, retaining the existing research pipeline and its source-grounding rules, native visitor limits, DailyBudget migration, offline knowledge, calculators, vectors, notes and static code workspace. Current chat styles and attached notes are passed intact to the selected provider. Cloudflare FLUX adds a third image connection profile to the pool; the existing image API shape remains compatible. The old voluntary browser-wide three-image cap and repeated confirmation are replaced with server-enforced per-provider budgets.

Owner setup: add a Worker secret `MIKEE_ADMIN_TOKEN` containing at least 24 random characters. Settings → Connections can generate one. Unlock that page with the same token, add a free-account key, confirm that paid billing/top-up are disabled, then test a real response. Keys are AES-GCM encrypted on the server. They are never sent back in status responses or stored in browser preferences. Owner access is held only in memory for the tab. Alternatively use provider Worker secrets plus `MIKEE_FREE_PROVIDERS` as a comma-separated free-account declaration.
