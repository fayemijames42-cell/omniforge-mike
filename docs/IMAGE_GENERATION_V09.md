# OMNIFORGE v0.9 — Optional True AI Image Generation

## Why this increment
A user requested a cow picture. The previous system used a language model to write SVG instructions; the resulting drawing visibly did not resemble a cow. SVG rendering worked technically, but that is not genuine text-to-image generation.

## Implementation
- Text messages explicitly requesting an image, photo, illustration or picture are intercepted by the frontend and offered **one opt-in FLUX.1 Schnell generation**. No extra language-model call is made for routing.
- Cloudflare Workers AI image model: `@cf/black-forest-labs/flux-1-schnell`, using the existing AI binding with four inference steps, and a single request. No new API key or paid plan.
- Users must approve the request in a confirmation dialog. A **voluntary browser-local cap of 3 attempts per UTC day** is applied to discourage spending the shared free allowance accidentally. This is not a global authenticated rate limiter and can be bypassed by independent clients; a public deployment requires stronger server-side protections.
- The returned JPEG is stored locally in IndexedDB's existing asset blob storage and displayed in chat with a download button. Images are not automatically synced or uploaded to public storage.
- Existing SVG drawings now offer an explicit **Create real AI image instead** button, which preserves the original sketch and asks for opt-in before using Workers AI credits.
- If inference fails or quota runs out, show a transparent error. **Do not substitute misleading SVG results** pretending they are photorealistic pictures.
- Numerical questions and offline knowledge continue working as previously; generated images cannot be produced with Local Knowledge mode.
- Real model output on Cloudflare remains **unverified until a real user invokes image generation**. A successful build exercises mocked inference only.

## Budget
Cloudflare documents FLUX.1 Schnell as a Workers AI text-to-image model with usage metered in neurons. It is not listed as a paid-only model in the official pricing documentation (checked October 2026). It shares the existing **10,000 free neurons per day** with other Workers AI requests. No automatic recurring inference, retry, provider fallback chains, or billing changes.

## Manual acceptance
1. From **Cloud AI** mode, request `Generate an image of a cow in a meadow`.
2. Verify an explicit approval dialog; decline and verify no image request.
3. Approve once, and confirm either one generated JPEG displays or a transparent model error appears. This is a real model call consuming the allowance.
4. Tap `Save image` and confirm the downloaded JPEG opens.
5. Reload and confirm image persists in the same browser (IndexedDB).
6. Open an older SVG chat and use `Create real AI image instead` to test the upgrade route.
7. In Local Knowledge mode, request an image and verify no cloud inference is made.
8. Confirm `2 + 1`, an ordinary learning question, and website preview still work.

## Limits
- Model availability and output quality depend on Cloudflare. It may fail if that day's free allowance is exhausted.
- User-controlled usage gate is **not sufficient to secure an unauthenticated public paid-service endpoint**. Keep the Workers account on Free plan to ensure it never generates paid overages, and consider server rate limiting and authentication before broad publication.
- Exporting conversation text alone does not include the image bytes. To preserve images, download them separately.
- Removing a chat may leave an orphaned image blob in local device storage. Garbage collection is a separate future enhancement.
