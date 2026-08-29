/**
 * Expo config.
 *
 * Everything static lives in `app.json`; this wrapper exists for one thing that
 * cannot be static — the Firebase config file.
 *
 * `android.googleServicesFile` must point at a real file or the native build
 * fails outright. But `google-services.json` is per-deployment and gitignored,
 * so a fresh clone does not have one. Declaring it unconditionally means nobody
 * can build the app until they have set up Firebase; omitting it means push
 * silently never works once they have. Reading it conditionally gives both: the
 * app builds without Firebase (in-app inbox only, no push), and picks the file
 * up automatically the moment it is dropped in.
 */

const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, "google-services.json");

  if (!fs.existsSync(googleServices)) {
    return {
      ...config,
      android: { ...config.android, googleServicesFile: undefined },
    };
  }

  return {
    ...config,
    android: { ...config.android, googleServicesFile: "./google-services.json" },
  };
};
