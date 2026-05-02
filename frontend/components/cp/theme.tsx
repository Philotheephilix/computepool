"use client";

import * as React from "react";

export type Palette = {
  primary: string;
  primaryDeep: string;
  primaryLight: string;
  primaryMid: string;
  name: string;
};

export const PALETTES: Record<string, Palette> = {
  indigo:  { primary: "#4338CA", primaryDeep: "#3730A3", primaryLight: "#E0E7FF", primaryMid: "#A5B4FC", name: "Indigo" },
  cobalt:  { primary: "#1D4ED8", primaryDeep: "#1E3A8A", primaryLight: "#DBEAFE", primaryMid: "#93C5FD", name: "Cobalt" },
  violet:  { primary: "#7C3AED", primaryDeep: "#5B21B6", primaryLight: "#EDE9FE", primaryMid: "#C4B5FD", name: "Violet" },
  emerald: { primary: "#059669", primaryDeep: "#065F46", primaryLight: "#D1FAE5", primaryMid: "#6EE7B7", name: "Emerald" },
  ember:   { primary: "#EA580C", primaryDeep: "#9A3412", primaryLight: "#FFEDD5", primaryMid: "#FDBA74", name: "Ember" },
};

export type Theme = {
  primary: string;
  primaryDeep: string;
  primaryLight: string;
  primaryMid: string;
  bg: string;
  surface: string;
  surfaceWarm: string;
  border: string;
  borderStrong: string;
  text1: string;
  text2: string;
  text3: string;
  amber: string;
  amberLight: string;
  red: string;
  redLight: string;
  purple: string;
  purpleLight: string;
};

export function buildTheme(p: Palette, dark: boolean): Theme {
  if (dark) {
    return {
      primary: p.primary, primaryDeep: p.primaryDeep,
      primaryLight: "rgba(99,102,241,0.16)", primaryMid: p.primaryMid,
      bg: "#0B0B10", surface: "#13131A", surfaceWarm: "#1A1A22",
      border: "#26262E", borderStrong: "#3A3A45",
      text1: "#F4F4F0", text2: "#A8A39A", text3: "#6E6A62",
      amber: "#FBBF24", amberLight: "rgba(251,191,36,0.14)",
      red: "#F87171", redLight: "rgba(248,113,113,0.14)",
      purple: "#A78BFA", purpleLight: "rgba(167,139,250,0.14)",
    };
  }
  return {
    primary: p.primary, primaryDeep: p.primaryDeep,
    primaryLight: p.primaryLight, primaryMid: p.primaryMid,
    bg: "#FAFAF7", surface: "#FFFFFF", surfaceWarm: "#F5F3EE",
    border: "#E8E5DF", borderStrong: "#C9C5BC",
    text1: "#1C1917", text2: "#57534E", text3: "#A8A29E",
    amber: "#B45309", amberLight: "#FEF3C7",
    red: "#DC2626", redLight: "#FEE2E2",
    purple: "#7C3AED", purpleLight: "#EDE9FE",
  };
}

export const FONT_DISPLAY = "var(--font-display), 'Sora', system-ui, sans-serif";
export const FONT_BODY    = "var(--font-body), 'Instrument Sans', system-ui, sans-serif";
export const FONT_MONO    = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";

const ThemeCtx = React.createContext<Theme | null>(null);

export function ThemeProvider({ value, children }: { value: Theme; children: React.ReactNode }) {
  React.useEffect(() => {
    document.body.style.background = value.bg;
    document.documentElement.style.setProperty("--cp-primary", value.primary);
  }, [value]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useT(): Theme {
  const v = React.useContext(ThemeCtx);
  if (!v) throw new Error("useT must be used inside <ThemeProvider>");
  return v;
}
