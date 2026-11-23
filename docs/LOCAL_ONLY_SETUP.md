# OMNIFORGE · MICHELLE — no-cloud local runtime

## Mandatory retirement of billing

Source changes do not cancel Cloudflare fees. In your Cloudflare account, open **Billing → Subscriptions**, cancel **Workers Paid** (or change to Free), confirm its effective date and review all other paid add-ons. Check **Workers & Pages** for **omniforge-mike** and remove the live Worker or disable its routes once you have a backup and local replacement. The old workers.dev address will no longer serve the app. Do not redeploy the older branch `offline/michelle-on-device-20261123`, which retains live Cloudflare bindings. This repository now intentionally fails `npm run deploy`.

## Run without cloud services

1. Install Node.js 22 or newer, and Ollama on the computer that will run MICHELLE (one-time installation requires internet or an offline installer).
2. Download the model **once**, while an internet connection is available: `ollama pull qwen2.5:0.5b`. This is a small ~398 MB model, not GPT-6. A more capable computer can use `OMNIFORGE_LOCAL_MODEL=qwen2.5:1.5b` after installing that model.
3. Run Ollama locally. On systems that do not start it automatically: `ollama serve`.
4. In the OMNIFORGE repository, run `npm run offline:start` (Node 22+; no Cloudflare token or API key). This builds local static files and opens a local server at `http://127.0.0.1:4321`.
5. Open that address on **the same computer**. Turn Wi-Fi off after installation to test chat, calculations, local backups and website editing. The AI requires the Ollama service and downloaded model to remain installed/running; the built-in reference, notes and manual tools work without it.

There is **no subscription cost**, and local chat requests are sent by the bundled server to `127.0.0.1:11434` on the same computer. No Cloudflare Worker is involved. The local HTTP server binds only to `127.0.0.1` by default, rather than exposing private projects to a local network or public internet. The published website URL cannot be used by remote visitors after cancellation; a genuine offline service is device-local. Browser storage is separate for the old workers.dev origin and the new localhost origin, so **export saved projects and knowledge on the old site before it is disabled** and then import the backups into the local app.

The small model is significantly less capable than ChatGPT. It may be slow or inaccurate, especially for complex websites, code and mathematics, and does **not** have live search, remote account sync, cloud image generation or transcription. Features needing external services report unavailability rather than claiming to work. This server does not execute model-written code, and website output still passes through the frontend's existing validation checks before saving.

## Diagnostics

- `npm run offline:test` tests the local HTTP API using a simulated model response. This does not verify a real installed model.
- `http://127.0.0.1:4321/api/health` reports whether the local model name is installed; `modelReady: true` is a readiness check, not proof of a successful answer.
- To verify actual inference, send a message in MICHELLE and confirm that the provider in Response details is **On-device Ollama**. Disconnect the computer from the internet and repeat with a *new question*.
- If a browser displays old cloud errors, confirm it is opened at `127.0.0.1:4321`, not the former workers.dev address. The **This device only** toggle intentionally restricts chat to saved knowledge; leave it on **Auto** to use the locally running language model.

### Security and storage

Model prompts, recent messages, selected user-approved notes, and existing site source are processed on the current machine. Never expose the local HTTP server publicly. Back up browser data with the existing ZIP/JSON and knowledge XML exporters before clearing site data. Installing a model and starting a local server are prerequisites; this release does not magically embed a large model in the browser.
