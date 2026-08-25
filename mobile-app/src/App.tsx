/**
 * Web entry component.
 *
 * `src/main.tsx` (the Vite entry) renders this, while the native build enters
 * through `expo/AppEntry.js` → the root `App.tsx`. Both must mount the *same*
 * tree: this file used to export the navigator on its own, so the web target
 * rendered without a single provider and every `useAuth()` threw.
 *
 * Re-export the real root rather than repeating the provider stack — two copies
 * would drift.
 */

export { default } from "../App";
