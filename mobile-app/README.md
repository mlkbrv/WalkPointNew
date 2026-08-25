# STRIDE mobile app

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript.

## Run

```bash
npm install
npm start          # Expo Go / a dev build — the real target
npm run dev        # browser, via Vite + react-native-web
npm run lint       # tsc --noEmit
```

Point the app at an API with `EXPO_PUBLIC_API_BASE_URL` (see `.env.example`).
On the web that can stay empty: the dev server proxies `/v1` to
`http://localhost:8000`.

## The two targets

The device build is the product. The browser build exists for fast iteration on
layout and API wiring, and it differs in ways that matter:

| | Device | Browser |
|---|---|---|
| Entry | `expo/AppEntry.js` → `App.tsx` | `src/main.tsx` → `src/App.tsx` → `App.tsx` |
| `react-native` | the real thing | `react-native-web` |
| Tokens | Keychain / Keystore (`tokenStore.native.ts`) | AsyncStorage (`tokenStore.ts`) |
| Pedometer, push, camera | real | absent |

Both entries must mount the same provider tree. `src/App.tsx` re-exports the root
`App.tsx` rather than repeating it — it once exported the bare navigator, and the
browser build rendered with no providers at all.

`vite.config.ts` carries the pieces that make React Native packages work in a
browser: `react-native` → `react-native-web`, `.web.*` resolution ahead of the
plain extensions, `__DEV__` and `process.env` defines, the Reanimated Babel
plugin, and React deduplication. Each is commented with what breaks without it.

## Layout

| Path | Role |
|---|---|
| `src/api/` | the only place that talks HTTP — auth header, error envelope, refresh |
| `src/contexts/` | `AuthContext` (session), `ServerDataContext` (server state), `HealthContext`, `StrideContext` (local UI state) |
| `src/hooks/` | step sync, push registration |
| `src/screens/` | one file per screen |
| `src/components/` | shared UI |
| `src/theme.ts` | the design tokens every screen imports |

**Screens never call the network.** Screen → context → `src/api`. That is what
keeps the two targets identical.

## Still on mock data

`ScoreboardScreen`, the workout screens, and the merchant screens read
`src/utils/mockData.ts`. They are waiting on endpoints the API does not have yet
(leaderboard, workouts); the merchant screens are superseded by the partner
console in `admin-panel/`.
