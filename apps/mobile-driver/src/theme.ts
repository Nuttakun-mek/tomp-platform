// One place for how the shell looks. Sizes, spacing and colour all live here so
// a screen cannot quietly invent its own — before this file carried a scale,
// App.tsx held nine different font sizes and forty-four raw hex values.

import { useColorScheme } from "react-native";

export const lightColors = {
  ink: "#102034",
  muted: "#5c6f84",
  canvas: "#edf4f7",
  surface: "#ffffff",
  /** Cards and inputs that need to sit just off white. */
  surfaceSoft: "#f8fbfd",
  surfaceRaised: "#fbfdff",
  line: "#d7e3ed",
  lineSoft: "#cbd7e3",
  placeholder: "#7d8b99",
  operation: "#087f73",
  operationDeep: "#05645e",
  operationSoft: "#e2f3f1",
  route: "#2563eb",
  success: "#16a34a",
  warning: "#b7791f",
  warningSoft: "#fff7ed",
  warningLine: "#fed7aa",
  danger: "#dc2626",
  dangerSoft: "#fff1f2",
  dangerLine: "#fecdd3",
  command: "#0b2538",
  commandMid: "#123852",
  /** The dark scanner backdrop, deeper than `command` so the frame reads. */
  commandDeep: "#061421",
  /** Brand mint — the wordmark and the active locale chip on the dark bar. */
  accent: "#8be2da",
  /** Text on the dark command bar. */
  onCommand: "#d6e5ee",
  onCommandMuted: "#bdd1df",
  /** Status text tuned for the dark bar, where the solid tones go muddy. */
  successOnDark: "#86efac",
  warningOnDark: "#f8d181",
  dangerOnDark: "#fecaca"
};

/** Translucent fills over the command bar and the camera. */
export const lightOverlay = {
  faint: "rgba(255,255,255,0.08)",
  soft: "rgba(255,255,255,0.12)",
  frame: "rgba(255,255,255,0.85)",
  scannerLabel: "rgba(6,20,33,0.78)",
  successFill: "rgba(34,197,94,0.16)",
  warningFill: "rgba(245,158,11,0.13)",
  dangerFill: "rgba(239,68,68,0.14)"
};

/** Same shape as `lightColors`, tuned for a dark background. */
export const darkColors: typeof lightColors = {
  ink: "#e8eef5",
  muted: "#9fb0c2",
  canvas: "#0f1c28",
  surface: "#16222f",
  surfaceSoft: "#1b2a38",
  surfaceRaised: "#1e2f3f",
  line: "#2a3b4b",
  lineSoft: "#233444",
  placeholder: "#6d8194",
  operation: "#3ecfc0",
  operationDeep: "#8be2da",
  operationSoft: "#123a37",
  route: "#5b8def",
  success: "#4ade80",
  warning: "#f0b45e",
  warningSoft: "#3a2a12",
  warningLine: "#5a4420",
  danger: "#f87171",
  dangerSoft: "#3a1418",
  dangerLine: "#5a2026",
  command: "#081521",
  commandMid: "#0d2334",
  commandDeep: "#04101a",
  accent: "#8be2da",
  onCommand: "#d6e5ee",
  onCommandMuted: "#8fa4b6",
  successOnDark: "#86efac",
  warningOnDark: "#f8d181",
  dangerOnDark: "#fecaca"
};

/** Same shape as `lightOverlay`, tuned for a dark background. */
export const darkOverlay: typeof lightOverlay = {
  faint: "rgba(255,255,255,0.06)",
  soft: "rgba(255,255,255,0.10)",
  frame: "rgba(255,255,255,0.7)",
  scannerLabel: "rgba(4,16,26,0.82)",
  successFill: "rgba(74,222,128,0.16)",
  warningFill: "rgba(240,180,94,0.14)",
  dangerFill: "rgba(248,113,113,0.16)"
};

export const radius = {
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24
};

// Six steps, each with the line height it must be used at.
//
// Thai needs more leading than Latin: tone marks sit above the character and
// the lower vowels below it, so at 1.2 the marks are clipped by the line box.
// Every step here is about 1.45, which is what stops ไม้โท and ไ from losing
// their heads in the tab bar. Nothing in the shell sets a bare fontSize.
export const text = {
  micro: { fontSize: 11, lineHeight: 16 },
  caption: { fontSize: 12, lineHeight: 18 },
  body: { fontSize: 14, lineHeight: 21 },
  strong: { fontSize: 16, lineHeight: 24 },
  title: { fontSize: 18, lineHeight: 26 },
  display: { fontSize: 24, lineHeight: 34 }
} as const;

// Three weights, loaded and used. `fontWeight` is deliberately absent
// everywhere: with a custom family, Android ignores it or fakes a synthetic
// bold on top of an already-bold file, which is what made the shell look
// shouty. The family name carries the weight.
export const font = {
  regular: "NotoSansThai_400Regular",
  semibold: "NotoSansThai_600SemiBold",
  bold: "NotoSansThai_700Bold"
} as const;

/** Anything a finger has to hit. Below this, a driver misses it in a moving vehicle. */
export const TOUCH_MIN = 44;

export type ThemeColors = typeof lightColors;
export type ThemeOverlay = typeof lightOverlay;
export type ThemePreference = "system" | "light" | "dark";

/** Picks the active palette from the OS appearance setting unless overridden. */
export function useAppTheme(preference: ThemePreference = "system"): { scheme: "light" | "dark"; colors: ThemeColors; overlay: ThemeOverlay } {
  const systemScheme = useColorScheme() === "dark" ? "dark" : "light";
  const scheme = preference === "system" ? systemScheme : preference;
  return scheme === "dark"
    ? { scheme, colors: darkColors, overlay: darkOverlay }
    : { scheme, colors: lightColors, overlay: lightOverlay };
}
