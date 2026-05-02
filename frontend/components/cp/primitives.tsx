"use client";

import * as React from "react";
import { useT, FONT_BODY, FONT_MONO } from "./theme";

export function Badge({
  kind = "primary",
  label,
  dot = true,
  style,
}: {
  kind?: "primary" | "amber" | "red" | "purple" | "offline";
  label: React.ReactNode;
  dot?: boolean;
  style?: React.CSSProperties;
}) {
  const T = useT();
  const map = {
    primary: { bg: T.primaryLight, fg: T.primary },
    amber:   { bg: T.amberLight,   fg: T.amber },
    red:     { bg: T.redLight,     fg: T.red },
    purple:  { bg: T.purpleLight,  fg: T.purple },
    offline: { bg: T.surfaceWarm,  fg: T.text3 },
  } as const;
  const c = map[kind] ?? map.primary;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      background: c.bg, color: c.fg,
      fontFamily: FONT_BODY, fontSize: 12, fontWeight: 500,
      whiteSpace: "nowrap",
      ...style,
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: 3, background: c.fg, display: "inline-block",
          animation: kind === "primary" ? "cp-pulse 1.6s ease-in-out infinite" : "none",
        }}/>
      )}
      {label}
    </span>
  );
}

export function Button({
  kind = "primary",
  children,
  onClick,
  style,
  full,
  disabled,
  type = "button",
}: {
  kind?: "primary" | "secondary" | "ghost" | "destructive";
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
  full?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const T = useT();
  const [hover, setHover] = React.useState(false);
  const styles = {
    primary:     { bg: T.primary,     fg: "#fff",  border: "transparent",  hover: T.primaryDeep },
    secondary:   { bg: T.surface,     fg: T.text1, border: T.borderStrong, hover: T.surfaceWarm },
    ghost:       { bg: "transparent", fg: T.text1, border: "transparent",  hover: T.surfaceWarm },
    destructive: { bg: T.redLight,    fg: T.red,   border: T.redLight,     hover: "#FCA5A5" },
  } as const;
  const s = styles[kind];
  const dim = disabled ? 0.5 : 1;
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover && !disabled ? s.hover : s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        borderRadius: 8,
        padding: "10px 20px",
        fontFamily: FONT_BODY,
        fontWeight: 500,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 150ms ease, transform 100ms ease, box-shadow 150ms ease",
        transform: hover && !disabled ? "translateY(-1px)" : "none",
        boxShadow: kind === "primary" && hover && !disabled ? `0 6px 18px ${T.primary}40` : "none",
        width: full ? "100%" : "auto",
        opacity: dim,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  style,
  padding = 24,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  padding?: number;
}) {
  const T = useT();
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      ...style,
    }}>{children}</div>
  );
}

export function FlowLine({
  d,
  frozen = false,
  stroke,
}: {
  d: string;
  frozen?: boolean;
  stroke?: string;
}) {
  const T = useT();
  return (
    <path
      d={d}
      stroke={frozen ? T.border : (stroke ?? T.primary)}
      strokeWidth={1.5}
      strokeDasharray="6 4"
      fill="none"
      opacity={frozen ? 0.5 : 1}
      className={frozen ? "" : "cp-flow"}
      style={{ transition: "stroke 400ms ease, opacity 400ms ease" }}
    />
  );
}

export function Ticker({
  value,
  decimals = 4,
  duration = 800,
  suffix = "",
  style,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  style?: React.CSSProperties;
}) {
  const [shown, setShown] = React.useState(value);
  const fromRef = React.useRef(value);
  const startRef = React.useRef(performance.now());
  const targetRef = React.useRef(value);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    fromRef.current = shown;
    targetRef.current = value;
    startRef.current = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = fromRef.current + (targetRef.current - fromRef.current) * eased;
      setShown(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span style={{ fontFamily: FONT_MONO, fontVariantNumeric: "tabular-nums", ...style }}>
      {shown.toFixed(decimals)}{suffix}
    </span>
  );
}

export const truncHex = (h: string, head = 6, tail = 4) =>
  h.length <= head + tail ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;

export function RowKV({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  const T = useT();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2, whiteSpace: "nowrap" }}>{k}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: T.text1, fontWeight: 500, whiteSpace: "nowrap", textAlign: "right" }}>{v}</span>
    </div>
  );
}
