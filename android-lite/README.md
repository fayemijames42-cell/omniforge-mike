# OMNIFORGE · MICHELLE — Android Lite alpha

Native Android 10+ (API 29) for low-memory phones, starting with the TECNO Spark 5 Air: 2 GB RAM, 32 GB storage, 720 × 1640, Android 10. This is an independent Android application, not the Windows Electron project.

## What the source implements

- Native dark UI, conversations, private notes, model status, GGUF model import, validated JSON conversation export and restore, and confirmed chat deletion.
- Private saved chats and a deterministic offline arithmetic parser, without any fake AI answers or arbitrary code execution.
- llama.cpp JNI local inference using a pinned upstream source revision, one CPU model at a time, 1,024-token context, two threads, and a 128-token generation limit.
- Model imported through Android's trusted system document picker. File magic/size/free-storage checks and background loading. Clear errors if memory or the engine is unavailable.
- No Cloudflare, no cloud inference API, no subscriptions, no internet permission, and no account sync.

## Device compatibility

The screenshot does not reveal supported Android ABIs. The latest test build compiles for **arm64-v8a and armeabi-v7a**, covering both 64-bit and 32-bit ARM Android environments. The actual Spark 5 Air ABI was not shown in the screenshot. Native model loading, speed, and stability remain unverified on that phone.

Start by testing the official Qwen2.5-0.5B-Instruct Q4_K_M GGUF (~491 MB):
https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/blob/main/qwen2.5-0.5b-instruct-q4_k_m.gguf

Model weights are not bundled. The user must obtain a trusted GGUF file once and import it. Afterwards inference is offline. A 2 GB RAM device may still fail to load this model or run it slowly. Native operation and memory use have not yet been measured on the Spark 5 Air.

## Build

Native source pinned to llama.cpp commit:
1f8baae28d096624bd47d33d2d179ec479d47720

Using JDK 17, Android SDK 35, NDK 27.2.12479018, CMake 3.22.1 and Gradle 8.11.1:

1. Clone official llama.cpp into android-lite/vendor/llama.cpp at the pinned commit above.
2. Run: gradle -p android-lite :app:assembleDebug
3. Obtain the generated debug APK from android-lite/app/build/outputs/apk/debug/app-debug.apk.

The GitHub Actions workflow builds the app, tests the arithmetic parser, checks the presence of native model libraries for **both ARM architectures**, records SHA-256 and attaches a downloadable debug APK artifact if successful. The default APK is a *debug*, not a production-signed release.

## Known limitations

- Android architecture, real inference, quality, peak memory, performance and usability on the exact TECNO phone are not yet certified.
- Voice, images, website editor, online research, login, cloud sync, social agents, automatic updates and native web browsing are not implemented in this Android alpha.
- Android Lite can export and restore its own versioned JSON chat backups with validated records and explicit confirmation. Its format is separate from OMNIFORGE's website-project ZIP/JSON; automatic cross-platform migration still needs a converter.
- The app has no internet permission. Download the model through a trusted external channel, then select it using the app's document picker.
- Before sharing publicly, validate actual on-device performance, accessibility, install/update data retention, code signing, backups, and license notices.

The original OMNIFORGE web/desktop projects remain preserved. Do not interpret a build passing as proof that the Android AI ran on a 2 GB device.
