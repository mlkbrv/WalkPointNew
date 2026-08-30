const { withProjectBuildGradle } = require("expo/config-plugins");

/**
 * Move every module's native build staging out of node_modules.
 *
 * Windows' ninja is not long-path aware and gives up at 260 characters, even
 * with the OS-level LongPathsEnabled set — it does not declare itself
 * long-path aware, so the setting does not reach it. CMake mirrors each
 * absolute source path *inside* the module's own `.cxx` directory, so a path
 * deep in node_modules is counted twice: object files here reached 409
 * characters and the build died with either "Filename longer than 260
 * characters" or the more confusing "manifest 'build.ninja' still dirty after
 * 100 tries" (CMake could not read back its own output, so it regenerated
 * forever).
 *
 * This lives as a config plugin rather than a hand edit to `android/` because
 * `android/` is generated and gitignored: every `expo prebuild` throws the edit
 * away, and the next build then fails for a reason that looks nothing like the
 * prebuild that caused it.
 *
 * No-op off Windows, where the limit does not exist.
 */
module.exports = function withCxxStagingDir(config, { stagingRoot } = {}) {
  if (process.platform !== "win32") return config;

  const root = stagingRoot || "C:/cxx";
  const marker = "stride:cxx-staging";

  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        "withCxxStagingDir expects a Groovy build.gradle; got " + cfg.modResults.language,
      );
    }
    if (cfg.modResults.contents.includes(marker)) return cfg;

    // Must run before anything evaluates the subprojects: registering an
    // afterEvaluate hook on an already-evaluated project throws.
    cfg.modResults.contents =
      `// ${marker} — see mobile-app/plugins/withCxxStagingDir.js\n` +
      `subprojects { subproject ->\n` +
      `    subproject.afterEvaluate {\n` +
      `        try {\n` +
      `            if (subproject.extensions.findByName('android') != null) {\n` +
      `                subproject.android.externalNativeBuild.cmake.buildStagingDirectory =\n` +
      `                    new File("${root}/\${subproject.name}")\n` +
      `            }\n` +
      `        } catch (Exception ignored) {\n` +
      `            // Modules without a native build have nothing to redirect.\n` +
      `        }\n` +
      `    }\n` +
      `}\n\n` +
      cfg.modResults.contents;

    return cfg;
  });
};
