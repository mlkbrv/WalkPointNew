#!/usr/bin/env bash
# Build the release APK inside the container. Run by `docker run`, not directly.
#
# Produces an UNSIGNED apk: the signing key stays on the developer's machine.
set -euo pipefail

API_URL="${EXPO_PUBLIC_API_BASE_URL:?set EXPO_PUBLIC_API_BASE_URL}"

cd /workspace/mobile-app

echo "==> Installing dependencies"
npm ci --no-audit --no-fund

echo "==> Prebuild (clean)"
# Written to .env because the Expo config and the bundler both read it from there.
printf 'EXPO_PUBLIC_API_BASE_URL=%s\n' "$API_URL" > .env
npx expo prebuild --clean -p android

echo "==> assembleRelease"
cd android
# Only the two ABIs real phones use; x86 images are for emulators and double the
# build time for nothing here.
./gradlew assembleRelease \
    -PreactNativeArchitectures=arm64-v8a,armeabi-v7a \
    --no-daemon

echo "==> Output"
ls -lh app/build/outputs/apk/release/
