#!/usr/bin/env bash
# Build the release APK inside the container. Run by `docker run`, not directly.
#
# Produces an UNSIGNED apk: the signing key stays on the developer's machine.
#
# Memory is the constraint, not CPU. Compiling the native modules for two ABIs
# at once on a 8 GB box gets the gradle daemon killed by the OOM killer, which
# surfaces as the unhelpful "Gradle build daemon disappeared unexpectedly". So
# the heap is capped, the worker count is held down, and only one ABI is built
# by default.
set -euo pipefail

API_URL="${EXPO_PUBLIC_API_BASE_URL:?set EXPO_PUBLIC_API_BASE_URL}"
# arm64-v8a covers every Android phone shipped since roughly 2017. Add
# armeabi-v7a only if genuinely old hardware has to be supported — it doubles
# the native compile.
ABIS="${ANDROID_ABIS:-arm64-v8a}"
HEAP="${GRADLE_HEAP:-3g}"
WORKERS="${GRADLE_WORKERS:-2}"

cd /workspace/mobile-app

echo "==> Installing dependencies"
npm ci --no-audit --no-fund

echo "==> Prebuild (clean)"
# Written to .env because the Expo config and the bundler both read it there.
printf 'EXPO_PUBLIC_API_BASE_URL=%s\n' "$API_URL" > .env
npx expo prebuild --clean -p android

echo "==> assembleRelease  abis=$ABIS heap=$HEAP workers=$WORKERS"
cd android
./gradlew assembleRelease \
    -PreactNativeArchitectures="$ABIS" \
    -Dorg.gradle.jvmargs="-Xmx${HEAP} -XX:MaxMetaspaceSize=768m" \
    --max-workers="$WORKERS" \
    --no-daemon

echo "==> Output"
ls -lh app/build/outputs/apk/release/
