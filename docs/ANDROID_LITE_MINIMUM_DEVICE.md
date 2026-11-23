# OMNIFORGE Android Lite — minimum-device engineering target

**Target device shown by the owner, 23 November 2026:** TECNO Spark 5 Air, **2.00 GB RAM**, **32.00 GB internal storage**, **quad-core 2.0 GHz CPU**, **720 × 1640 display**, **Android 10 / HiOS 6.2.0**. These facts come from the device screenshot. Device architecture (supported 32-/64-bit ABIs) and actual free storage/RAM are **not established by this screenshot**.

## Decision

The Windows Electron/Ollama desktop build **does not run on Android**. An Android application must be developed as a separate native Android package (APK/AAB) retaining the OMNIFORGE/MICHELLE identity and user-facing features. Target **Android 10 / API 29 or newer** for the first build, while verifying real device compatibility before claiming support.

**Do not mandate large desktop models on this phone.** A 2 GB system has a severe RAM constraint. Start with the openly licensed official **Qwen2.5-0.5B-Instruct-GGUF Q4_K_M**, roughly **491 MB model file** as listed in the official Qwen GGUF repository. Do **not** claim its run-time memory equals file size; OS, app, activation, context/KV cache and inference overhead all require additional memory. If it is not viable on this actual phone, test a smaller compatible instruct model or disable chat inference gracefully. Even if it runs, a 0.5B model is much less capable than large cloud models.

Official references:
- https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF
- https://github.com/ggml-org/llama.cpp/blob/master/docs/android.md

## Native architecture (proposed; not built)

1. **Android UI / shell:** use Kotlin and Jetpack components, or a small local WebView with bundled OMNIFORGE assets and a strictly local app-owned message bridge. Browser-only functions must not silently call the retired Worker. Never expose a localhost server beyond loopback. Android is not a Windows Electron target.
2. **Inference:** integrate a pinned/tested `llama.cpp` Android/JNI build with GGUF files in app-private storage (no mandatory Termux, Ollama, cloud API or desktop installation). Determine `Build.SUPPORTED_ABIS` at runtime; do **not assume 64-bit Android** based only on the CPU brand or stated GHz. If only a 32-bit app environment is available, validate a supported native build before claiming inference works.
3. **Resource limits:** begin experiments at **512-1024 context tokens**, **1-2 inference threads**, modest generation length, and one model at a time. Do not run inference when Android reports low memory. Offer explicit Stop and Recover controls. Treat these as **test hypotheses**, not confirmed optimal settings.
4. **Models:** check available free storage and device memory before importing or downloading a model. Download only with user consent and show size/network status, integrity and license. Allow model import from a trusted GGUF file for devices that cannot download through the app. Do not automatically pull multi-gigabyte weights.
5. **Offline functionality:** deterministic arithmetic and supported manual notes/projects should remain available even when model load fails. All conversation history, settings and model files stay on the device. Offer export/import of projects and conversations. Never imply cross-device synchronization, web access, offline image generation or autonomous app control without actual implementations.
6. **Distribution:** produce a normal Android APK that can be installed independently on each supported phone. The no-weights APK would require a one-time model download/import; an offline bundle can separately include model weights if licensing, integrity and device storage permit. Software signing, malware scans, supported ABI testing and real hardware acceptance are required before release.

## Release acceptance test on TECNO Spark 5 Air

- [ ] Record actual Android API level, `SUPPORTED_ABIS`, storage available and free RAM.
- [ ] Verify the APK starts, displays correctly at 720 × 1640, and launches without external sign-in.
- [ ] Confirm app remains functional in airplane mode and **cannot contact Cloudflare or paid providers**.
- [ ] Load a verified local GGUF model on the actual 2 GB device without force-closes; report peak memory and response latency, not estimates.
- [ ] Run a series of basic daily conversation, writing, arithmetic and short education tasks offline; record accuracy and quality limitations.
- [ ] Stop inference and recover after low-memory conditions without deleting saved conversations.
- [ ] Verify chat history, notes and project backups survive process termination and reboot.
- [ ] Validate 32-/64-bit builds against the actual device ABI and with a second independent Android device.
- [ ] Test app upgrade, clean installation and user-controlled data export/import.
- [ ] Produce a signed, verifiable APK before calling this a shareable Android release.

## Status

**Specification recorded, Android APK NOT built.** The existing OMNIFORGE Desktop Windows beta remains separate. Do not claim MICHELLE is already running an LLM on this TECNO until native inference is implemented and measured on a real device.
