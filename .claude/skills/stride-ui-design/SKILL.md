---
name: stride-ui-design
description: Design system and visual conventions for the STRIDE app UI. Use when creating or restyling any screen, component, card, button, badge, chart, empty state, or modal in this repo — anything involving colors, spacing, radii, shadows, typography, or dark mode. Trigger on "сделай красиво", "дизайн экрана", "поправь стили", "new screen UI", "redesign".
---

# STRIDE UI design system

The single source of truth is `mobile-app/src/theme.ts`. **Never hardcode a hex color, px radius, or spacing number** in a screen — import from the theme.

```ts
import { colors, spacing, radii, shadows } from "../theme";
```

## Tokens

| Group | Values |
|---|---|
| Brand | `primary #8140F3` (violet, main CTA), `coral #FF6B52` (alerts / streaks), `emerald #00E194` (success, steps, tokens earned) |
| Surfaces | light: `canvas` bg, `card` white, `border`; dark: `dark` bg, `cardDark`, `borderDark` |
| Text | `text` (light mode), `textLight` (dark mode), `slate` (secondary), `muted` (tertiary / disabled) |
| Spacing | `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32` |
| Radii | `sm 8 · md 12 · lg 16 · xl 24 · full 999` |
| Shadows | `shadows.glass` (cards), `shadows.glow` (primary CTAs, active states) |

If a new value is genuinely needed, **add it to `theme.ts`** rather than inlining it.

## Visual language

- **Glassmorphism**: cards are `GlassCard` (`mobile-app/src/components/GlassCard.tsx`) — translucent surface, `radii.xl`, hairline border, `shadows.glass`. Pass `dark` for dark surfaces. Do not re-implement card styling.
- **Every tap target is `PressableScale`** (`mobile-app/src/components/PressableScale.tsx`), not a bare `TouchableOpacity`. It carries the scale-down feedback that defines the app's feel.
- **Haptics on meaningful actions**: `import * as Haptics from "expo-haptics"` — `impactAsync(Light)` for taps, `notificationAsync(Success)` for earning tokens / redeeming a coupon.
- **Gradients** via `expo-linear-gradient`; brand gradient runs `primary → coral` diagonally. Progress rings use `react-native-svg` `Circle` with `strokeDasharray`/`strokeDashoffset` (see `HomeScreen` `RING`/`CIRC` constants).
- **Motion**: `react-native-reanimated` for gesture-driven and looping animation; `motion` only in web-only code paths.

## Layout rules

- Screens start with `useSafeAreaInsets()` and apply `paddingTop: insets.top`, and `paddingBottom: insets.bottom + 96` when the bottom tab bar is visible.
- Header is `ScreenHeader` (`mobile-app/src/components/ScreenHeader.tsx`) — do not hand-roll a title row.
- Content scrolls in a `ScrollView` with `contentContainerStyle`, `showsVerticalScrollIndicator={false}`.
- Section rhythm: `spacing.xxl` between sections, `spacing.lg` between cards, `spacing.md` inside a card.
- Styles live in a `StyleSheet.create({...})` at the **bottom** of the file, not inline objects, except for dynamic values (computed widths, animated colors).

## Typography scale

| Role | Size / weight |
|---|---|
| Screen title | 28 / `"800"` |
| Section header | 18 / `"700"` |
| Card title | 16 / `"600"` |
| Body | 14 / `"500"`, color `slate` |
| Caption / meta | 12 / `"500"`, color `muted` |
| Big metric (steps, tokens) | 40–48 / `"800"`, tabular feel |

## Dark mode

Every surface must resolve both themes. Read the theme flag the way sibling screens do, and pick `colors.card` vs `colors.cardDark`, `colors.text` vs `colors.textLight`, `colors.border` vs `colors.borderDark`. Never ship a screen that is only checked in light mode.

## Web parity

The app also renders in the browser, through **react-native-web**. So:
- Any React Native primitive react-native-web implements works in both targets — that is nearly all of them.
- No `Platform.OS === "web"` branches in screens; platform divergence belongs in `*.native.ts` / `*.web.ts` files, resolved by the bundler.
- Icons: `@expo/vector-icons` `Ionicons` only (works both targets). `lucide-react` is web-only — do not import it in screens.

## Checklist before saying a screen is done

1. Theme tokens only, no literals. 2. `PressableScale` on every tap target. 3. Safe-area top and bottom. 4. Loading, empty, and error states drawn. 5. Dark mode verified. 6. Renders in `npm run dev` (web) without console errors. 7. `npm run lint` clean.
