# Android build environment.
#
# Exists because the Windows build of react-native-reanimated 4.5 loops on
# `ninja: error: manifest 'build.ninja' still dirty after 100 tries` — CMake
# regenerates on every invocation and ninja gives up. Reanimated 4 requires the
# New Architecture, so the usual escape of turning that off is not available;
# the bug is specific to the Windows toolchain, and Linux builds the same source
# without complaint.
#
# The APK this produces is **unsigned** on purpose. Signing happens on the
# developer's machine afterwards, so the release keystore never has to travel to
# a server.

FROM eclipse-temurin:17-jdk-jammy

ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl git unzip zip ca-certificates python3 \
    && rm -rf /var/lib/apt/lists/*

# Node 20: Expo's prebuild and the Metro bundler both run during the gradle build.
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Android command-line tools, then the exact SDK pieces RN 0.86 asks for.
RUN mkdir -p "$ANDROID_HOME/cmdline-tools" \
    && curl -fsSL -o /tmp/tools.zip \
        https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
    && unzip -q /tmp/tools.zip -d "$ANDROID_HOME/cmdline-tools" \
    && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" \
    && rm /tmp/tools.zip

ENV PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# `yes |` accepts the SDK licences non-interactively — there is no other way to
# install them, and a build cannot proceed without them.
RUN yes | sdkmanager --licenses > /dev/null 2>&1 || true
RUN sdkmanager --install \
        "platform-tools" \
        "platforms;android-35" \
        "build-tools;35.0.0" \
        "ndk;27.1.12297006" \
        "cmake;3.22.1" \
    > /dev/null

WORKDIR /workspace
