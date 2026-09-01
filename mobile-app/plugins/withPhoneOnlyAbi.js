const { withGradleProperties } = require("expo/config-plugins");

/**
 * Build native code for real phones only.
 *
 * Expo's default is all four architectures — armeabi-v7a, arm64-v8a, x86 and
 * x86_64 — and every one of them carries a complete set of native libraries.
 * With MapLibre in the app that came to 120 MB of libraries in a 142 MB APK,
 * where a single architecture needs 32 MB. The two x86 variants exist for
 * emulators on a desktop and are dead weight on any handset.
 *
 * This lives in a config plugin because android/gradle.properties is generated
 * and gitignored. It had been set to arm64-v8a by hand once; a later
 * `expo prebuild` regenerated the file, silently restored Expo's default, and
 * the APK tripled without anything in the diff to explain it.
 *
 * To build for an emulator, override on the command line rather than editing
 * this — the flag beats the property:
 *
 *     ./gradlew assembleRelease -PreactNativeArchitectures=x86_64
 */
module.exports = function withPhoneOnlyAbi(config, { architectures } = {}) {
  const value = (architectures || ["arm64-v8a"]).join(",");

  return withGradleProperties(config, (cfg) => {
    const key = "reactNativeArchitectures";
    const existing = cfg.modResults.find(
      (item) => item.type === "property" && item.key === key,
    );
    if (existing) existing.value = value;
    else cfg.modResults.push({ type: "property", key, value });
    return cfg;
  });
};
