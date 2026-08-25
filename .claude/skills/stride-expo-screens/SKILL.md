---
name: stride-expo-screens
description: How to add or modify screens, navigation, contexts, and hooks in this Expo + React Native app, and how to run it on native and web. Use when adding a screen, wiring a route or tab, touching RootNavigator, adding a context/hook, using an expo-* module (camera, sensors, haptics, image-picker), or when something breaks only on web.
---

# Working in the STRIDE Expo app

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript. Two render targets from one codebase:

- **Native**: `npm start` (`expo start`), entry `node_modules/expo/AppEntry.js` → `App.tsx`.
- **Web**: `npm run dev` (Vite, port 3000), entry `index.html` → `src/main.tsx` → `src/App.tsx` → the root `App.tsx`. `react-native` is aliased to **react-native-web**; there are no hand-written shims any more.

Typecheck with `npm run lint` (`tsc --noEmit`) — there is no test suite; typecheck plus a web render is the verification bar.

## Layout

```
mobile-app/src/
  App.tsx                 provider stack
  navigation/RootNavigator.tsx   all routes + tabs
  screens/*Screen.tsx     one file per screen, named export
  components/             shared UI (GlassCard, PressableScale, ScreenHeader, ...)
  contexts/               AuthContext, HealthContext, StrideContext
  hooks/                  useSeenStories, useStrideState (dead — do not extend)
  utils/                  metrics.ts, mockData.ts, stories.ts
  api/                    the only place that talks HTTP
  theme.ts  types.ts
```

## Adding a screen

1. `mobile-app/src/screens/FooScreen.tsx`, `export function FooScreen()` — named export, no default.
2. Register it in `mobile-app/src/navigation/RootNavigator.tsx` (stack or tab, matching how neighbours are declared) and add the route + its params to the navigator's param list.
3. Navigate with `const navigation = useNavigation<any>()` — the codebase uses `any` here consistently; do not introduce a competing typing scheme unilaterally.
4. Follow **stride-ui-design** for everything visual.

## State

Three contexts, consumed via their hooks — never import the context object directly:

| Hook | Owns |
|---|---|
| `useAuth()` | session/user, persisted under `@stride/auth_user` |
| `useHealth()` | steps, pedometer/Health Connect permission state, `@stride/health_mock_v2`, `@stride/health_connect_gate_v1` |
| `useStride()` | stats, coupons, wallet, inbox, workouts, leaderboard, toasts — persisted under `@stride/app_state_v3` |

Rules: state that must survive a restart goes through a context that persists it to AsyncStorage (debounced write in an effect, hydrate once on mount) — screens never call `AsyncStorage` directly. Token balance is derived via `balanceFromParts` in `mobile-app/src/utils/metrics.ts`, never mutated as a free-standing number. `mobile-app/src/hooks/useStrideState.ts` is dead code kept for reference.

`mobile-app/src/utils/mockData.ts` and `stories.ts` are placeholders for the real API — see **stride-api-client** before adding new mock data.

## Native modules

Already installed and safe to use: `expo-camera` (merchant scanner), `expo-sensors` `Pedometer` (steps), `expo-haptics`, `expo-image-picker`, `expo-clipboard`, `expo-blur`, `expo-linear-gradient`, `expo-splash-screen`, `react-native-webview`.

- Always request permissions through the owning context (health permissions live in `HealthContext`), and handle denial with a visible UI state, not a silent no-op.
- On **Android** `HealthConnectWall` hard-blocks the Main stack until Health Connect is ready — see `docs/BACKEND_API.md` §1.2.1 before touching that flow.
- Adding a new native module: `npx expo install <pkg>` (not plain `npm install`, so the version matches SDK 57). If it has no web implementation, put the import behind a `*.native.ts` file rather than a runtime check — and re-run `npm install` afterwards, because `expo install` has been observed pruning transitive dependencies the web build needs.

## The two targets

| | Device | Browser |
|---|---|---|
| Entry | `expo/AppEntry.js` → `App.tsx` | `src/main.tsx` → `src/App.tsx` → `App.tsx` |
| `react-native` | the real thing | `react-native-web` |
| Tokens | Keychain / Keystore (`tokenStore.native.ts`) | AsyncStorage (`tokenStore.ts`) |

**Both entries must mount the same provider tree.** `src/App.tsx` re-exports the
root `App.tsx` rather than repeating it — it once exported the bare navigator, and
the browser build rendered with no providers at all, which surfaces as
`useAuth must be used within AuthProvider`.

Platform-specific code goes in `*.native.ts` / `*.web.ts` files, resolved by the
bundler. Do not branch on `Platform.OS` for anything that pulls in a native module —
the import itself is what breaks the web bundle, not the call.

## Web breakage triage

`mobile-app/vite.config.ts` carries every piece that makes React Native packages
run in a browser, each commented with what breaks without it: the
`react-native-web` alias, `.web.*` resolution ahead of plain extensions, the
`__DEV__` / `process.env` / `EXPO_OS` defines, the esbuild `.js`-as-JSX loader,
the Reanimated Babel plugin, and `dedupe` for React.

When something works on device but not in the browser:
1. **`must be used within a Provider`** → two copies of React, or app source pulled
   into `node_modules/.vite/deps`. Check `dedupe`.
2. **`X is not defined` at module scope** → a global React Native injects and the
   browser does not. Add a `define`.
3. **`does not provide an export named …`** → a package expecting a native module.
   Check whether it ships a `.web.` variant that resolution should be finding.

There is a documented HMR/file-watch guard driven by `DISABLE_HMR` — leave it as is.

## Secrets

`GEMINI_API_KEY` comes from `.env.local` (see `.env.example`). Never commit keys; never hardcode a base URL or key in a screen.
