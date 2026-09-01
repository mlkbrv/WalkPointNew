/**
 * Flags drawn as SVG rather than emoji.
 *
 * Emoji flags are a per-platform lottery: Windows renders them as two letters,
 * some Android builds ship no flag glyphs at all, and where they do render the
 * size and baseline differ from the text beside them. These are the same
 * everywhere and can be sized exactly.
 *
 * Deliberately simplified — the proportions are normalised to one 3:2 box so a
 * row of them lines up, rather than each being drawn to its own official ratio.
 */

import Svg, { Circle, Path, Rect, G, Defs, ClipPath } from "react-native-svg";

import type { LanguageCode } from "../i18n/strings";

const W = 30;
const H = 20;

export function FlagIcon({ code, size = W }: { code: LanguageCode; size?: number }) {
  const height = (size / W) * H;

  return (
    <Svg width={size} height={height} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <ClipPath id={`flag-${code}`}>
          <Rect x="0" y="0" width={W} height={H} rx="2.5" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#flag-${code})`}>
        {code === "ru" ? (
          <>
            <Rect x="0" y="0" width={W} height={H / 3} fill="#FFFFFF" />
            <Rect x="0" y={H / 3} width={W} height={H / 3} fill="#0039A6" />
            <Rect x="0" y={(H / 3) * 2} width={W} height={H / 3} fill="#D52B1E" />
          </>
        ) : null}

        {code === "tr" ? (
          <>
            <Rect x="0" y="0" width={W} height={H} fill="#E30A17" />
            {/* Crescent: a white disc with a red one biting into it. */}
            <Circle cx="11.5" cy={H / 2} r="4.6" fill="#FFFFFF" />
            <Circle cx="13.3" cy={H / 2} r="3.7" fill="#E30A17" />
            <Path
              d="M18.6 10 L20.9 10.75 L19.5 8.8 L20.9 6.85 L18.6 7.6 L17.2 5.65 L17.2 8 L14.9 8.75 L17.2 9.5 L17.2 11.85 Z"
              fill="#FFFFFF"
            />
          </>
        ) : null}

        {code === "en" ? (
          <>
            <Rect x="0" y="0" width={W} height={H} fill="#012169" />
            {/* Saltire, then the cross over it. */}
            <Path d="M0 0 L30 20 M30 0 L0 20" stroke="#FFFFFF" strokeWidth="4" />
            <Path d="M0 0 L30 20 M30 0 L0 20" stroke="#C8102E" strokeWidth="2" />
            <Path d={`M15 0 V20 M0 ${H / 2} H30`} stroke="#FFFFFF" strokeWidth="6.5" />
            <Path d={`M15 0 V20 M0 ${H / 2} H30`} stroke="#C8102E" strokeWidth="3.9" />
          </>
        ) : null}
      </G>
      <Rect
        x="0.4"
        y="0.4"
        width={W - 0.8}
        height={H - 0.8}
        rx="2.2"
        fill="none"
        stroke="rgba(0,0,0,0.16)"
        strokeWidth="0.8"
      />
    </Svg>
  );
}
