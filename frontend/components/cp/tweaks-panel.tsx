"use client";

import * as React from "react";
import { useT, FONT_BODY, FONT_DISPLAY, PALETTES } from "./theme";
import type { Tweaks } from "@/lib/use-tweaks";

export function TweaksPanel({
  tweaks,
  set,
}: {
  tweaks: Tweaks;
  set: <K extends keyof Tweaks>(k: K, v: Tweaks[K]) => void;
}) {
  const T = useT();
  const [open, setOpen] = React.useState(false);

  return (
    <div
      style={{
        position: "fixed", right: 16, bottom: 16, zIndex: 100,
        fontFamily: FONT_BODY,
      }}
    >
      {open && (
        <div style={{
          width: 280,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
          padding: 18,
          marginBottom: 10,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: T.text1 }}>Tweaks</span>
            <button onClick={() => setOpen(false)}
              style={{ border: "none", background: "transparent", color: T.text3, cursor: "pointer", fontSize: 14 }}>×</button>
          </div>

          <Section title="Palette">
            <Select
              label="Primary color"
              value={tweaks.palette}
              onChange={(v) => set("palette", v)}
              options={Object.keys(PALETTES).map((k) => ({ value: k, label: PALETTES[k].name }))}
            />
            <Toggle
              label="Dark mode"
              value={tweaks.dark}
              onChange={(v) => set("dark", v)}
            />
          </Section>

          <Section title="Network graph">
            <Toggle
              label="Show coalition"
              value={tweaks.showCoalition}
              onChange={(v) => set("showCoalition", v)}
            />
          </Section>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Tweaks"
        style={{
          width: 44, height: 44, borderRadius: 22,
          background: T.surface,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 14px rgba(0,0,0,0.10)",
          cursor: "pointer",
          fontSize: 18,
          color: T.text1,
        }}
      >⚙</button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const T = useT();
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontFamily: FONT_BODY, fontSize: 11, color: T.text3,
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
      }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const T = useT();
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, color: T.text2 }}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: `1px solid ${T.border}`,
          background: T.surface, color: T.text1,
          fontFamily: FONT_BODY, fontSize: 13,
          padding: "5px 8px", borderRadius: 6,
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Toggle({
  label, value, onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const T = useT();
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, color: T.text2, cursor: "pointer" }}>
      <span>{label}</span>
      <span
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10, padding: 2,
          background: value ? T.primary : T.border,
          transition: "background 200ms ease",
          cursor: "pointer", display: "inline-block",
        }}
      >
        <span style={{
          display: "block", width: 16, height: 16, borderRadius: 8,
          background: "#fff",
          transform: value ? "translateX(16px)" : "translateX(0)",
          transition: "transform 200ms ease",
        }}/>
      </span>
    </label>
  );
}
