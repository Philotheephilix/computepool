"use client";

import * as React from "react";
import { useT, FONT_BODY, FONT_MONO } from "./theme";
import { Badge, Card, FlowLine } from "./primitives";

export function Stat({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  const T = useT();
  return (
    <Card padding={18}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display, Sora), system-ui, sans-serif", fontWeight: 600, fontSize: 26, color: T.text1, marginTop: 8, letterSpacing: "-0.01em" }}>{value}</div>
    </Card>
  );
}

export function NodeRow({
  id, hex, rate, frozen,
}: {
  id: string;
  hex: string;
  rate: React.ReactNode;
  frozen: boolean;
}) {
  const T = useT();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "8px 12px", borderRadius: 8,
      background: frozen ? T.redLight : T.surfaceWarm,
      transition: "background 400ms ease",
    }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: frozen ? T.red : T.text1, width: 60 }}>{id}</span>
      <svg width="80" height="14" style={{ flexShrink: 0 }}>
        <FlowLine d="M 4 7 L 70 7" frozen={frozen}/>
        <polygon points="70,3 78,7 70,11" fill={frozen ? T.border : T.primary}/>
      </svg>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text3, flex: 1 }}>{hex}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: frozen ? T.text3 : T.primary, fontWeight: 500 }}>{rate}</span>
    </div>
  );
}

export function LiveJob({
  model, pool, pct, elapsed, breached, small,
}: {
  model: string;
  pool: string;
  pct: number;
  elapsed: string;
  breached: boolean;
  small?: boolean;
}) {
  const T = useT();
  return (
    <div style={{ padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontFamily: "var(--font-display, Sora), system-ui, sans-serif", fontSize: 15, fontWeight: 600, color: T.text1 }}>{model}</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text3, marginLeft: 10 }}>· {pool}</span>
        </div>
        <Badge kind={breached ? "amber" : "primary"} label={breached ? "degraded" : "streaming"}/>
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct * 100}%`, background: T.primary, transition: "width 200ms ease" }}/>
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2 }}>{Math.round(pct * 100)}% · {elapsed}</span>
      </div>
      {!small && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <NodeRow id="node-a" hex="0xaaa…1234" rate="+0.04/min" frozen={false}/>
          <NodeRow id="node-b" hex="0xbbb…5678" rate={breached ? "—" : "+0.04/min"} frozen={breached}/>
        </div>
      )}
    </div>
  );
}

export function EventRow({
  kind, label, meta, t,
}: {
  kind: "primary" | "purple" | "red" | "amber";
  label: React.ReactNode;
  meta: React.ReactNode;
  t: React.ReactNode;
}) {
  const T = useT();
  const dotColor = { red: T.red, primary: T.primary, purple: T.purple, amber: T.amber }[kind];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: dotColor }}/>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text1, fontWeight: 500, width: 160 }}>{label}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2, flex: 1 }}>{meta}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3 }}>{t} ↗</span>
    </div>
  );
}

export function Sparkline() {
  const T = useT();
  const data = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => 0.3 + 0.4 * Math.abs(Math.sin(i * 0.5)) + Math.random() * 0.15),
    [],
  );
  const max = Math.max(...data);
  const W = 720, H = 160;
  const pts = data.map((v, i) => [i * (W / (data.length - 1)), H - (v / max) * H * 0.85 - 10]);
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" ");
  const fill = `${d} L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="cp-spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={T.primary} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={T.primary} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#cp-spark)"/>
      <path d={d} stroke={T.primary} strokeWidth="2" fill="none"/>
      {data.map((_, i) => (
        <text key={i} x={i * (W / (data.length - 1))} y={H + 16} fontFamily={FONT_MONO} fontSize="9" fill={T.text3} textAnchor="middle">
          {i % 4 === 0 ? `${i}h` : ""}
        </text>
      ))}
    </svg>
  );
}
