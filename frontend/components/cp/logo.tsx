"use client";

import * as React from "react";
import { useT, FONT_DISPLAY } from "./theme";

export function LogoMark({ size = 26 }: { size?: number }) {
  const T = useT();
  const r = size / 2;
  const hex = (cx: number, cy: number, R: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)].join(","));
    }
    return pts.join(" ");
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <polygon points={hex(r * 0.78, r, r * 0.55)} fill={T.text1} opacity="0.92"/>
      <polygon points={hex(r * 1.22, r, r * 0.55)} fill={T.primary}/>
    </svg>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  const T = useT();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size}/>
      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: size * 0.78, color: T.text1, letterSpacing: "-0.01em" }}>
        ComputePool
      </span>
    </span>
  );
}
