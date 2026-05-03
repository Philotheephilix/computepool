"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import Link from "next/link";

const { useEffect, useRef, useState, useCallback } = React;

const ACCENT = "#A5B4FC";
const ACCENT_DEEP = "#6366F1";
const ACCENT_BRIGHT = "#818CF8";
const X402 = "#FBBF24";
const SUPER = "#22D3EE";
const RED = "#F87171";
const BG = "#0A0A0F";
const SURFACE = "#13131A";
const SURFACE_2 = "#1A1A22";
const BORDER = "#26262E";
const TEXT2 = "#A8A39A";
const TEXT3 = "#6E6A62";
const FONT_DISPLAY = "var(--font-display), 'Sora', system-ui, sans-serif";
const FONT_BODY = "var(--font-body), 'Instrument Sans', system-ui, sans-serif";
const FONT_MONO = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";

function Eyebrow({ children, color = ACCENT }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontFamily: FONT_MONO, fontSize: 12, color, fontWeight: 500,
      letterSpacing: "0.18em", textTransform: "uppercase",
    }}>{children}</div>
  );
}

function Pill({ children, color = ACCENT, bg }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      background: bg || `${color}1A`, color,
      fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500,
      letterSpacing: "0.04em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color, animation: "pitch-pulse 1.6s ease-in-out infinite" }}/>
      {children}
    </span>
  );
}

function Stat({ value, label, color = ACCENT, sub }: { value: string; label: string; color?: string; sub?: string }) {
  return (
    <div>
      <div className="pitch-stat" style={{
        fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 64, color,
        letterSpacing: "-0.04em", lineHeight: 0.95,
      }}>{value}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: TEXT3, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 10 }}>
        {label}
      </div>
      {sub && <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: TEXT2, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function PartnerHeader({ src, name, eyebrow, color }: { src: string; name: string; eyebrow: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
      <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
        <div style={{
          position: "absolute", inset: -10, borderRadius: 20,
          background: `radial-gradient(circle, ${color}33, transparent 70%)`,
          animation: "pitch-pulse 2.4s ease-in-out infinite",
        }}/>
        <img src={src} alt={name} width={64} height={64}
          style={{ width: 64, height: 64, borderRadius: 14, position: "relative", border: `1px solid ${BORDER}`, background: SURFACE_2, objectFit: "cover" }}/>
      </div>
      <div>
        <Eyebrow color={color}>{eyebrow}</Eyebrow>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 26, color: "#F4F4F0", marginTop: 6, letterSpacing: "-0.01em" }}>{name}</div>
      </div>
    </div>
  );
}

function PRBadge({ pr, status = "open", color, href }: { pr: string; status?: "open" | "merged" | "shipped"; color: string; href?: string }) {
  const dot = status === "merged" ? "#A78BFA" : status === "shipped" ? "#34D399" : color;
  const inner = (
    <>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: dot, animation: "pitch-pulse 1.6s ease-in-out infinite" }}/>
      <span style={{ color }}>{pr}</span>
      <span style={{ color: TEXT3, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>· {status}</span>
      {href && <span style={{ color: TEXT3, fontSize: 11, marginLeft: 2 }}>↗</span>}
    </>
  );
  const baseStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "5px 10px", borderRadius: 6,
    background: `${color}11`, border: `1px solid ${color}33`,
    fontFamily: FONT_MONO, fontSize: 11, color: "#F4F4F0",
    textDecoration: "none", cursor: href ? "pointer" : "default",
    transition: "background 200ms ease, border-color 200ms ease",
  };
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={baseStyle}
        onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.borderColor = `${color}66`; }}
        onMouseLeave={e => { e.currentTarget.style.background = `${color}11`; e.currentTarget.style.borderColor = `${color}33`; }}
      >{inner}</a>
    );
  }
  return <span style={baseStyle}>{inner}</span>;
}

function InnovCard({ children, color, style }: { children: React.ReactNode; color: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderTop: `2px solid ${color}`,
      borderRadius: 14, padding: 20,
      display: "flex", flexDirection: "column", gap: 12,
      position: "relative", overflow: "hidden",
      ...style,
    }}>
      <div style={{
        position: "absolute", top: -40, right: -40, width: 120, height: 120,
        background: `radial-gradient(circle, ${color}22, transparent 70%)`,
        pointerEvents: "none",
      }}/>
      {children}
    </div>
  );
}

function useTick(ms = 16) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(x => x + ms / 1000), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

function AtlasSVG() {
  const t = useTick();
  const cx = 280, cy = 250, R = 170;
  const nodes = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 8 + t * 0.08;
    return {
      x: cx + R * Math.cos(a),
      y: cy + R * Math.sin(a) * 0.85,
      r: 11 + 2 * Math.sin(t * 1.2 + i),
      i,
    };
  });
  return (
    <svg width="560" height="500" viewBox="0 0 560 500" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      <defs>
        <radialGradient id="hg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT_BRIGHT} stopOpacity="0.18"/>
          <stop offset="60%" stopColor={ACCENT_BRIGHT} stopOpacity="0.04"/>
          <stop offset="100%" stopColor={ACCENT_BRIGHT} stopOpacity="0"/>
        </radialGradient>
        <pattern id="hgrid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#26262E" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="560" height="500" fill="url(#hgrid)" opacity="0.4"/>
      <circle cx={cx} cy={cy} r={R * 1.4} fill="url(#hg)"/>
      <ellipse cx={cx} cy={cy} rx={R} ry={R * 0.85} fill="none" stroke={ACCENT} strokeOpacity="0.18" strokeDasharray="2 4"/>
      {nodes.map(n => (
        <line key={"e" + n.i} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={ACCENT} strokeOpacity="0.22"/>
      ))}
      {nodes.filter((_, i) => i % 2 === 0).map(n => (
        <line key={"f" + n.i} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={ACCENT_BRIGHT} strokeWidth="1.2" strokeDasharray="6 4" className="pitch-flow"/>
      ))}
      {nodes.map(n => (
        <g key={"n" + n.i}>
          <circle cx={n.x} cy={n.y} r={n.r + 8} fill={ACCENT_BRIGHT} fillOpacity="0.12"/>
          <circle cx={n.x} cy={n.y} r={n.r} fill={ACCENT_BRIGHT}/>
        </g>
      ))}
      {nodes.map(n => {
        const phase = ((t * 0.5 + n.i * 0.3) % 1);
        return <circle key={"p" + n.i} cx={cx + (n.x - cx) * phase} cy={cy + (n.y - cy) * phase} r="3" fill={X402} opacity={1 - phase * 0.4}/>;
      })}
      <circle cx={cx} cy={cy} r={36 + 2 * Math.sin(t * 1.4)} fill={ACCENT_DEEP} fillOpacity="0.16"/>
      <circle cx={cx} cy={cy} r="26" fill={ACCENT_BRIGHT}/>
      <text x={cx} y={cy + 5} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="20" fontWeight="600" fill={BG}>◆</text>
    </svg>
  );
}

function ProblemSVG() {
  const t = useTick();
  return (
    <svg width="520" height="360" viewBox="0 0 640 440" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      <rect x="220" y="80" width="200" height="120" rx="14" fill={SURFACE_2} stroke={BORDER}/>
      <text x="320" y="130" textAnchor="middle" fontFamily={FONT_MONO} fontSize="13" fill={RED}>HYPERSCALER</text>
      <text x="320" y="158" textAnchor="middle" fontFamily={FONT_BODY} fontSize="11" fill={TEXT3}>monthly billing · long contracts</text>
      <text x="320" y="178" textAnchor="middle" fontFamily={FONT_BODY} fontSize="11" fill={TEXT3}>opaque pricing · vendor lock-in</text>
      {[0, 1, 2, 3, 4].map(i => {
        const x = 60 + i * 120;
        return (
          <g key={i}>
            <rect x={x - 26} y="320" width="52" height="52" rx="10" fill={SURFACE} stroke={BORDER}/>
            <text x={x} y="350" textAnchor="middle" fontFamily={FONT_MONO} fontSize="11" fill={TEXT2}>dev</text>
            <line x1={x} y1="320" x2="320" y2="200" stroke={RED} strokeOpacity="0.4" strokeDasharray="3 3"/>
            <text x={x} y="396" textAnchor="middle" fontFamily={FONT_MONO} fontSize="10" fill={TEXT3}>net 30</text>
          </g>
        );
      })}
      {[0, 1, 2, 3, 4].map(i => {
        const x = 60 + i * 120;
        const phase = ((t * 0.15 + i * 0.2) % 1);
        return (
          <text key={"d" + i} x={x} y={320 - phase * 120} fontFamily={FONT_MONO} fontSize="14" fill={RED} opacity={0.6 - phase * 0.5} textAnchor="middle">$</text>
        );
      })}
    </svg>
  );
}

function ArchitectureSVG() {
  const t = useTick();
  const W = 780, H = 500;
  const entryX = 200, exitX = 580, midY = 230;
  // Pulse position 0..1 along entry → exit (hidden states going forward)
  const fwd = (t * 0.6) % 1;
  // Pulse position 0..1 along exit → entry (sampled token coming back)
  const back = (t * 0.6 + 0.5) % 1;
  return (
    <svg width="640" height="410" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      <defs>
        <pattern id="agrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={BORDER} strokeWidth="0.5"/>
        </pattern>
        <linearGradient id="vrambar" x1="0%" x2="100%">
          <stop offset="0%" stopColor={ACCENT_BRIGHT}/>
          <stop offset="100%" stopColor={ACCENT_DEEP}/>
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#agrid)" opacity="0.4"/>

      {/* Header — model spec */}
      <text x={W / 2} y={56} textAnchor="middle" fontFamily={FONT_MONO} fontSize="11" fill={TEXT3} letterSpacing="0.18em">QWEN3-4B-INSTRUCT · 36 LAYERS · 8.0 GB</text>

      {/* Two GPU cards */}
      {([
        { x: entryX, label: "node-a · entry shard", slice: "embed + layers 0..17", vramUsed: 4.0 },
        { x: exitX,  label: "node-b · exit shard",  slice: "layers 18..35 + lm_head", vramUsed: 4.0 },
      ]).map((g, i) => (
        <g key={i}>
          <rect x={g.x - 110} y={midY - 80} width="220" height="190" rx="14" fill={SURFACE} stroke={ACCENT_DEEP} strokeOpacity="0.55" strokeWidth="1.5"/>
          <text x={g.x} y={midY - 56} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize="14" fontWeight="600" fill={ACCENT_BRIGHT}>{g.label}</text>
          <text x={g.x} y={midY - 38} textAnchor="middle" fontFamily={FONT_MONO} fontSize="10" fill={TEXT2}>RTX 4090 · 24 GB</text>
          {/* GPU slab */}
          <rect x={g.x - 80} y={midY - 22} width="160" height="46" rx="6" fill={SURFACE_2} stroke={BORDER}/>
          <text x={g.x} y={midY + 6} textAnchor="middle" fontFamily={FONT_MONO} fontSize="11" fill="#F4F4F0">{g.slice}</text>
          {/* VRAM bar */}
          <text x={g.x - 80} y={midY + 50} fontFamily={FONT_MONO} fontSize="9" fill={TEXT3}>VRAM</text>
          <rect x={g.x - 80} y={midY + 58} width="160" height="8" rx="4" fill={SURFACE_2}/>
          <rect x={g.x - 80} y={midY + 58} width={160 * (g.vramUsed / 24)} height="8" rx="4" fill="url(#vrambar)"/>
          <text x={g.x + 80} y={midY + 50} textAnchor="end" fontFamily={FONT_MONO} fontSize="9" fill={TEXT2}>{g.vramUsed} / 24 GB</text>
          {/* Pulsing activity dot */}
          <circle cx={g.x + 86} cy={midY - 56} r="4" fill={ACCENT_BRIGHT} opacity={0.5 + 0.5 * Math.sin(t * 4 + i * 1.6)}/>
        </g>
      ))}

      {/* Forward pipe — hidden states */}
      <text x={(entryX + exitX) / 2} y={midY - 38} textAnchor="middle" fontFamily={FONT_MONO} fontSize="11" fill={ACCENT_BRIGHT} letterSpacing="0.1em">hidden states · AXL P2P</text>
      <line x1={entryX + 110} y1={midY - 14} x2={exitX - 110} y2={midY - 14} stroke={ACCENT_BRIGHT} strokeWidth="1.5" strokeDasharray="6 4" className="pitch-flow"/>
      <polygon points={`${exitX - 110},${midY - 19} ${exitX - 100},${midY - 14} ${exitX - 110},${midY - 9}`} fill={ACCENT_BRIGHT}/>
      {/* Pulsing tensor packet */}
      <rect
        x={entryX + 110 + (exitX - 110 - entryX - 110) * fwd - 14}
        y={midY - 22} width="28" height="14" rx="3"
        fill={ACCENT_BRIGHT} opacity={0.85}
      />
      <text
        x={entryX + 110 + (exitX - 110 - entryX - 110) * fwd}
        y={midY - 12} textAnchor="middle" fontFamily={FONT_MONO} fontSize="9" fill={BG} fontWeight="500"
      >h</text>

      {/* Back pipe — sampled token */}
      <line x1={exitX - 110} y1={midY + 18} x2={entryX + 110} y2={midY + 18} stroke={X402} strokeWidth="1.5" strokeDasharray="6 4" className="pitch-flow"/>
      <polygon points={`${entryX + 110},${midY + 13} ${entryX + 100},${midY + 18} ${entryX + 110},${midY + 23}`} fill={X402}/>
      <text x={(entryX + exitX) / 2} y={midY + 42} textAnchor="middle" fontFamily={FONT_MONO} fontSize="11" fill={X402} letterSpacing="0.1em">sampled token · AXL P2P</text>
      <circle
        cx={exitX - 110 - (exitX - 110 - entryX - 110) * back}
        cy={midY + 18} r="5" fill={X402}
      />

      {/* Bottom: orchestrator + payment side-rail */}
      <g>
        <rect x={W / 2 - 90} y={H - 90} width="180" height="58" rx="10" fill={SURFACE} stroke={BORDER}/>
        <text x={W / 2} y={H - 66} textAnchor="middle" fontFamily={FONT_MONO} fontSize="11" fill={TEXT2}>orchestrator</text>
        <text x={W / 2} y={H - 50} textAnchor="middle" fontFamily={FONT_BODY} fontSize="10" fill={TEXT3}>routes · authenticates · settles</text>
      </g>
      <text x={W / 2 - 200} y={H - 60} textAnchor="middle" fontFamily={FONT_MONO} fontSize="10" fill={X402} letterSpacing="0.08em">x402 voucher</text>
      <line x1={W / 2 - 145} y1={H - 60} x2={W / 2 - 90} y2={H - 60} stroke={X402} strokeWidth="1.2" strokeDasharray="4 3"/>
      <text x={W / 2 + 200} y={H - 60} textAnchor="middle" fontFamily={FONT_MONO} fontSize="10" fill={SUPER} letterSpacing="0.08em">Superfluid stream</text>
      <line x1={W / 2 + 90} y1={H - 60} x2={W / 2 + 145} y2={H - 60} stroke={SUPER} strokeWidth="1.2" strokeDasharray="4 3"/>
    </svg>
  );
}

function TimelineSVG() {
  const points = [
    { y: "2022", label: "Crypto bust → idle gaming GPUs", color: TEXT3 },
    { y: "2024", label: "Open 4B/8B models match GPT-3.5", color: TEXT2 },
    { y: "2024", label: "x402 standard ships", color: X402 },
    { y: "2025", label: "Superfluid live on 0G", color: SUPER },
    { y: "2026", label: "ComputePool", color: ACCENT_BRIGHT },
  ];
  return (
    <svg width="900" height="180" viewBox="0 0 900 200" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      <line x1="60" y1="100" x2="840" y2="100" stroke={BORDER} strokeWidth="1.5"/>
      {points.map((p, i) => {
        const x = 60 + i * 195;
        return (
          <g key={`${p.y}-${i}`}>
            <circle cx={x} cy="100" r={i === 4 ? 10 : 6} fill={p.color}/>
            {i === 4 && <circle cx={x} cy="100" r="18" fill={p.color} fillOpacity="0.2"/>}
            <text x={x} y="80" textAnchor="middle" fontFamily={FONT_MONO} fontSize="13" fill={p.color} fontWeight="500">{p.y}</text>
            <text x={x} y="135" textAnchor="middle" fontFamily={FONT_BODY} fontSize="13" fill={i === 4 ? "#F4F4F0" : TEXT2}>{p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function MarketSVG() {
  const bars = [
    { label: "Sharded inference on consumer GPUs (SAM)", value: 6.4, color: ACCENT_BRIGHT },
    { label: "AI inference market (TAM)", value: 42.1, color: TEXT2 },
    { label: "Idle prosumer GPU compute (asset value)", value: 220, color: TEXT3 },
  ];
  const max = Math.max(...bars.map(b => Math.log10(b.value * 100)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {bars.map(b => {
        const pct = Math.log10(b.value * 100) / max * 100;
        return (
          <div key={b.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#F4F4F0" }}>{b.label}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: b.color, fontWeight: 500 }}>${b.value}B</span>
            </div>
            <div style={{ height: 12, background: SURFACE_2, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: b.color, borderRadius: 6, transition: "width 800ms ease" }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StreamDemo() {
  const t = useTick(50);
  const userBal = Math.max(0, 0.5 - t * 0.0084);
  const aBal = Math.min(t * 0.0042, 0.5);
  const bBal = Math.min(t * 0.0042, 0.5);
  return (
    <div style={{ width: "100%", maxWidth: 500, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: TEXT3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Live Stream · 0G testnet</span>
        <Pill color={SUPER} bg="rgba(34,211,238,0.1)">streaming</Pill>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT3 }}>user · 0x7a4f…c19e</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 34, color: "#F4F4F0", fontWeight: 500, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{userBal.toFixed(4)}</div>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: SUPER, marginBottom: 10 }}>−0.0084 USDCx/s</div>
      </div>
      <div style={{ height: 1, background: BORDER, margin: "12px 0" }}/>
      {[
        { id: "node-a", hex: "0xaaa…1234", bal: aBal },
        { id: "node-b", hex: "0xbbb…5678", bal: bBal },
      ].map(n => (
        <div key={n.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
          <div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#F4F4F0", fontWeight: 500 }}>{n.id}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: TEXT3 }}>{n.hex}</div>
          </div>
          <svg width="90" height="14"><line x1="2" y1="7" x2="80" y2="7" stroke={SUPER} strokeWidth="1.4" strokeDasharray="6 4" className="pitch-flow"/><polygon points="80,3 88,7 80,11" fill={SUPER}/></svg>
          <div style={{ fontFamily: FONT_MONO, fontSize: 18, color: SUPER, fontWeight: 500, fontVariantNumeric: "tabular-nums", minWidth: 90, textAlign: "right" }}>+{n.bal.toFixed(4)}</div>
        </div>
      ))}
    </div>
  );
}

function CompareTable() {
  const rows: string[][] = [
    ["Shards across consumer GPUs", "Yes — layer-pipelined", "No — one container, one host", "No — hosted-only", "No — single big GPU"],
    ["Min hardware per operator", "24 GB consumer card", "Whole-host VM", "—", "—"],
    ["Pricing model", "Per-second streaming", "Per-second", "Per-token", "Hourly + contracts"],
    ["Settlement", "On-chain (0G testnet)", "On-chain", "Off-chain", "Net-30 invoice"],
    ["Operators", "Permissionless", "Permissionless", "Hosted", "Single vendor"],
  ];
  return (
    <div style={{ width: "100%", borderRadius: 14, overflow: "hidden", border: `1px solid ${BORDER}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.3fr 1fr 1fr 1fr", background: SURFACE_2, padding: "16px 20px", gap: 16 }}>
        <span/>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: ACCENT_BRIGHT }}>ComputePool</span>
        <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: TEXT2 }}>Akash</span>
        <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: TEXT2 }}>Together AI</span>
        <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: TEXT2 }}>AWS Bedrock</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.3fr 1fr 1fr 1fr", padding: "14px 20px", gap: 16, borderTop: `1px solid ${BORDER}`, alignItems: "center" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: TEXT3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r[0]}</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#F4F4F0", fontWeight: 500 }}>{r[1]}</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2 }}>{r[2]}</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2 }}>{r[3]}</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2 }}>{r[4]}</span>
        </div>
      ))}
    </div>
  );
}

function Roadmap() {
  const items = [
    { q: "Q2 2026", t: "2-way shards", d: "Llama-3.2 / Qwen3-4B across pairs of 24 GB consumer cards", state: "now" },
    { q: "Q3 2026", t: "N-way shards", d: "4- and 8-way coalitions unlock 30B–70B class models on prosumer rigs", state: "next" },
    { q: "Q4 2026", t: "Heterogeneous coalitions", d: "Mix 3090s, 4090s, M-series Macs; orchestrator balances by VRAM + bandwidth", state: "next" },
    { q: "Q1 2027", t: "Verifiable inference", d: "zk-proofs of computation per shard — slashing for incorrect activations", state: "future" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
      {items.map(it => (
        <div key={it.q} style={{
          background: it.state === "now" ? `linear-gradient(180deg, ${ACCENT_DEEP}22, transparent)` : SURFACE,
          border: `1px solid ${it.state === "now" ? ACCENT_DEEP : BORDER}`,
          borderRadius: 14, padding: 18, position: "relative",
        }}>
          {it.state === "now" && <Pill color={ACCENT_BRIGHT} bg={`${ACCENT_DEEP}33`}>shipping</Pill>}
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: it.state === "now" ? ACCENT_BRIGHT : TEXT3, marginTop: it.state === "now" ? 12 : 0 }}>{it.q}</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 20, color: "#F4F4F0", marginTop: 10, letterSpacing: "-0.01em" }}>{it.t}</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, marginTop: 8, lineHeight: 1.5 }}>{it.d}</div>
        </div>
      ))}
    </div>
  );
}

function SequenceDiagram() {
  const lanes = ["Client", "Orchestrator", "Entry shard", "Exit shard", "Payment rails"];
  const steps = [
    { from: 0, to: 1, label: "POST /infer + x402 voucher", color: X402 },
    { from: 1, to: 4, label: "open Superfluid flow", color: SUPER },
    { from: 1, to: 2, label: "load layers 0..mid", color: ACCENT },
    { from: 1, to: 3, label: "load layers mid..N", color: ACCENT },
    { from: 2, to: 3, label: "hidden states · AXL", color: ACCENT_BRIGHT },
    { from: 3, to: 2, label: "sampled token · AXL", color: X402 },
    { from: 2, to: 3, label: "next hidden states (loop)", color: ACCENT_BRIGHT },
    { from: 2, to: 1, label: "EOS · final tokens", color: ACCENT },
    { from: 1, to: 0, label: "200 OK · stream", color: ACCENT },
  ];
  const W = 1080, laneY = 60, stepH = 36;
  const laneX = (i: number) => 100 + i * ((W - 200) / (lanes.length - 1));
  return (
    <svg width={W} height={laneY + steps.length * stepH + 30} viewBox={`0 0 ${W} ${laneY + steps.length * stepH + 30}`} style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      {lanes.map((l, i) => (
        <g key={l}>
          <line x1={laneX(i)} y1={laneY} x2={laneX(i)} y2={laneY + steps.length * stepH + 20} stroke={BORDER} strokeDasharray="2 4"/>
          <rect x={laneX(i) - 70} y={laneY - 44} width="140" height="32" rx="8" fill={SURFACE_2} stroke={BORDER}/>
          <text x={laneX(i)} y={laneY - 23} textAnchor="middle" fontFamily={FONT_MONO} fontSize="12" fill="#F4F4F0">{l}</text>
        </g>
      ))}
      {steps.map((s, i) => {
        const y = laneY + 30 + i * stepH;
        const x1 = laneX(s.from), x2 = laneX(s.to);
        const dir = x2 > x1 ? 1 : -1;
        return (
          <g key={i}>
            <line x1={x1} y1={y} x2={x2 - dir * 8} y2={y} stroke={s.color} strokeWidth="1.5"/>
            <polygon points={`${x2 - dir * 8},${y - 4} ${x2},${y} ${x2 - dir * 8},${y + 4}`} fill={s.color}/>
            <text x={(x1 + x2) / 2} y={y - 8} textAnchor="middle" fontFamily={FONT_MONO} fontSize="11" fill={s.color}>{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

type Slide = { id: string; label: string | null; content: React.ReactNode };

const SLIDES: Slide[] = [
  {
    id: "title",
    label: null,
    content: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
            <svg width="40" height="40" viewBox="0 0 40 40">
              <polygon points="11.6,8 22.6,8 28.4,20 22.6,32 11.6,32 5.8,20" fill={ACCENT_BRIGHT}/>
              <polygon points="20.6,8 31.6,8 37.4,20 31.6,32 20.6,32 14.8,20" fill="#F4F4F0" fillOpacity="0.92"/>
            </svg>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 22, color: "#F4F4F0", letterSpacing: "-0.01em" }}>ComputePool</span>
          </div>
          <h1 className="pitch-h1" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 68, color: "#F4F4F0", letterSpacing: "-0.04em", lineHeight: 0.98, margin: "0 0 22px" }}>
            Production inference<br/>on the GPUs<br/>you already own.
          </h1>
          <p style={{ fontFamily: FONT_BODY, fontSize: 17, color: TEXT2, lineHeight: 1.45, margin: "0 0 28px", maxWidth: 520 }}>
            Production LLMs don&apos;t fit on a single gaming GPU. We shard them across a coalition of consumer cards, layer-pipelined over P2P — and pay every operator by the second.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Pill>Sharded inference</Pill>
            <Pill color={X402} bg="rgba(251,191,36,0.1)">x402 payments</Pill>
            <Pill color={SUPER} bg="rgba(34,211,238,0.1)">Superfluid streams</Pill>
          </div>
          <div style={{ marginTop: 48, fontFamily: FONT_MONO, fontSize: 11, color: TEXT3, letterSpacing: "0.1em" }}>SERIES SEED · Q2 2026</div>
        </div>
        <div style={{ position: "relative" }}>
          <AtlasSVG/>
        </div>
      </div>
    ),
  },
  {
    id: "problem",
    label: "Problem",
    content: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
        <div>
          <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 64, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 28px" }}>
            A 70B model needs 140&nbsp;GB.<br/>A 4090 has 24.
          </h2>
          <p style={{ fontFamily: FONT_BODY, fontSize: 18, color: TEXT2, lineHeight: 1.55, marginBottom: 32 }}>
            Production LLMs don&apos;t fit on consumer GPUs — and datacenter cards that do cost $30k each and are perpetually back-ordered. So inference funnels to three hyperscalers, while hundreds of millions of capable consumer GPUs sit idle. Each one alone is too small to host a real model.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {([
              ["140 GB", "VRAM to serve a 70B model in fp16"],
              ["24 GB", "VRAM on a flagship RTX 4090"],
              ["$30k+", "price tag of a single H100"],
              ["~400M", "consumer GPUs sitting idle worldwide"],
            ] as const).map(([v, l]) => (
              <div key={l} style={{ borderLeft: `2px solid ${RED}`, paddingLeft: 14 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: RED, letterSpacing: "-0.02em" }}>{v}</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}><ProblemSVG/></div>
      </div>
    ),
  },
  {
    id: "solution",
    label: "Solution",
    content: (
      <div style={{ maxWidth: 1280 }}>
        <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 64, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 24px", maxWidth: 1100 }}>
          Shard the model. Cooperate. Serve.
        </h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 16, color: TEXT2, lineHeight: 1.45, marginBottom: 28, maxWidth: 900 }}>
          ComputePool splits a model layer-wise across two or more consumer GPUs. The entry shard runs the first half and streams hidden states over a P2P transport to the exit shard, which finishes the forward pass and samples the next token. No single card has to fit the whole model — the coalition does.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            { n: "01", t: "Layer-wise sharding", d: "A 12B model splits cleanly across two 24GB GPUs. Each operator only loads its slice — embeddings + early layers, or late layers + lm_head.", c: ACCENT_BRIGHT },
            { n: "02", t: "P2P hidden-state transport", d: "Activations move directly between operators over an authenticated mesh — no orchestrator round-trip per token.", c: X402 },
            { n: "03", t: "Pay per second of compute", d: "x402 opens the session; Superfluid streams USDCx to every operator in the coalition while inference runs.", c: SUPER },
          ].map(s => (
            <div key={s.n} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22, borderTop: `3px solid ${s.c}` }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: s.c, fontWeight: 500, letterSpacing: "0.04em" }}>{s.n}</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 24, color: "#F4F4F0", marginTop: 14, letterSpacing: "-0.01em" }}>{s.t}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 15, color: TEXT2, marginTop: 14, lineHeight: 1.55 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "arch",
    label: "Architecture",
    content: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
        <div>
          <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 56, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 24px" }}>
            One model, split in two.
          </h2>
          <p style={{ fontFamily: FONT_BODY, fontSize: 17, color: TEXT2, lineHeight: 1.55, marginBottom: 32 }}>
            The orchestrator picks a coalition and tells each node which layer slice to load. Hidden states travel from entry to exit over a P2P transport (AXL); the sampled token comes back the same way. Payments ride alongside on x402 + Superfluid.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "14px 16px", background: `${ACCENT_BRIGHT}14`, border: `1px solid ${ACCENT_BRIGHT}33`, borderRadius: 10 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: ACCENT_BRIGHT, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>entry shard · layers 0..mid</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#F4F4F0" }}>Holds embeddings + first half of transformer blocks. Outputs hidden states.</div>
            </div>
            <div style={{ padding: "14px 16px", background: `${ACCENT_BRIGHT}14`, border: `1px solid ${ACCENT_BRIGHT}33`, borderRadius: 10 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: ACCENT_BRIGHT, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>exit shard · layers mid..N</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#F4F4F0" }}>Finishes the forward pass + lm_head, samples the next token, ships it back.</div>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", gap: 10, fontFamily: FONT_MONO, fontSize: 11, color: TEXT3 }}>
              <span style={{ color: X402 }}>x402</span> opens session ·
              <span style={{ color: SUPER }}>Superfluid</span> streams payouts
            </div>
          </div>
        </div>
        <div><ArchitectureSVG/></div>
      </div>
    ),
  },
  {
    id: "sequence",
    label: "Request lifecycle",
    content: (
      <div>
        <h2 className="pitch-h2" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 48, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 12px" }}>
          One token, end to end.
        </h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 17, color: TEXT2, marginBottom: 36, maxWidth: 760 }}>
          Each token requires a hidden-state hop forward and a sampled-token hop back. The orchestrator never touches activations — the P2P transport keeps the loop tight even on consumer hardware.
        </p>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 32 }}>
          <SequenceDiagram/>
        </div>
      </div>
    ),
  },

  // ───────────── Innovation: Keeperhub ─────────────
  {
    id: "innov-keeperhub",
    label: "Innovation · Keeperhub",
    content: (
      <div>
        <PartnerHeader
          src="https://ethglobal.b-cdn.net/organizations/8exbf/square-logo/default.png"
          name="Keeperhub"
          eyebrow="Upstream contributions"
          color={SUPER}
        />
        <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 56, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 16px" }}>
          We brought streaming money<br/>to the workflow layer.
        </h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 16, color: TEXT2, lineHeight: 1.55, marginBottom: 28, maxWidth: 880 }}>
          Keeperhub orchestrates on-chain workflows but had no native way to handle continuous payouts or multi-worker consensus. We upstreamed both — and a unified payment model that combines x402 vouchers with Superfluid streams.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          <InnovCard color={SUPER}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", letterSpacing: "-0.01em" }}>Superfluid plugin</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, lineHeight: 1.55 }}>
              Native Superfluid actions — open, update, close streams — callable from any Keeperhub workflow.
            </div>
            <div style={{ marginTop: "auto", paddingTop: 8 }}>
              <PRBadge pr="keeperhub#142" status="open" color={SUPER} href="https://github.com/keeperhub/keeperhub/pull/142"/>
            </div>
          </InnovCard>

          <InnovCard color={SUPER}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", letterSpacing: "-0.01em" }}>Coagulation plugin</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, lineHeight: 1.55 }}>
              Multi-workflow consensus: N independent runs vote on an output before settlement. Distributed verifiability for any keeper job.
            </div>
            <div style={{ marginTop: "auto", paddingTop: 8 }}>
              <PRBadge pr="keeperhub#156" status="open" color={SUPER} href="https://github.com/keeperhub/keeperhub/pull/156"/>
            </div>
          </InnovCard>

          <InnovCard color={X402}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", letterSpacing: "-0.01em" }}>x402 + streams</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, lineHeight: 1.55 }}>
              Atomic onboarding plus per-second metering, packaged as one workflow primitive. The shape every API economy lands on.
            </div>
            <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", gap: 6 }}>
              <Pill color={X402} bg="rgba(251,191,36,0.12)">x402</Pill>
              <Pill color={SUPER} bg="rgba(34,211,238,0.12)">Superfluid</Pill>
            </div>
          </InnovCard>
        </div>
      </div>
    ),
  },

  // ───────────── Innovation: 0G ─────────────
  {
    id: "innov-0g",
    label: "Innovation · 0G",
    content: (
      <div>
        <PartnerHeader
          src="https://ethglobal.b-cdn.net/organizations/g8xu4/square-logo/default.png"
          name="0G"
          eyebrow="Protocol contributions"
          color="#4ADE80"
        />
        <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 56, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 16px" }}>
          Superfluid live on 0G.<br/>Consumer GPUs unlocked.
        </h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 16, color: TEXT2, lineHeight: 1.55, marginBottom: 28, maxWidth: 880 }}>
          0G has high-throughput compute, but only datacenter-class GPUs qualify — and there&apos;s no native streaming-money primitive. We shipped both: deterministic Superfluid contracts via CREATE2, and an SDK that fuses consumer cards into one virtual compute target while preserving 0G&apos;s signing model.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          <InnovCard color="#4ADE80">
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", letterSpacing: "-0.01em" }}>Superfluid on 0G</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, lineHeight: 1.55 }}>
              CREATE2-deployed, source-verified Superfluid contracts on 0G testnet — first per-second money streams the chain has ever had. Public, callable by anyone.
            </div>
            <div style={{ marginTop: "auto", paddingTop: 8 }}>
              <PRBadge pr="0G · CREATE2 verified" status="shipped" color="#4ADE80" href="https://chainscan-galileo.0g.ai/address/0x0000000000000000000000000000000000000000"/>
            </div>
          </InnovCard>

          <InnovCard color="#4ADE80">
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", letterSpacing: "-0.01em" }}>Pooled-GPU SDK</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, lineHeight: 1.55 }}>
              0G Compute mandates high-end GPUs; consumer cards are excluded. Our SDK pools them into one logical accelerator — small cards qualify together.
            </div>
            <div style={{ marginTop: "auto", paddingTop: 8, fontFamily: FONT_MONO, fontSize: 11, color: TEXT3 }}>
              <span style={{ color: "#4ADE80" }}>4× RTX 3090</span> → 1 virtual H100-class target
            </div>
          </InnovCard>

          <InnovCard color={ACCENT_BRIGHT}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", letterSpacing: "-0.01em" }}>TEE orchestrator</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, lineHeight: 1.55 }}>
              The orchestrator runs inside a Trusted Execution Environment, so 0G&apos;s native signing &amp; attestation flow stays intact end-to-end. No protocol downgrade for distributed inference.
            </div>
            <div style={{ marginTop: "auto", paddingTop: 8 }}>
              <Pill color={ACCENT_BRIGHT} bg={`${ACCENT_DEEP}33`}>SGX · attested</Pill>
            </div>
          </InnovCard>
        </div>
      </div>
    ),
  },

  // ───────────── Innovation: AXL / Gensyn ─────────────
  {
    id: "innov-axl",
    label: "Innovation · AXL (Gensyn)",
    content: (
      <div>
        <PartnerHeader
          src="https://ethglobal.b-cdn.net/organizations/zaxt3/square-logo/default.png"
          name="AXL · Gensyn"
          eyebrow="Transport + deployment"
          color={X402}
        />
        <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 56, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 16px" }}>
          What Gensyn drew on the whiteboard,<br/>we put in production.
        </h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 16, color: TEXT2, lineHeight: 1.55, marginBottom: 28, maxWidth: 880 }}>
          AXL is Gensyn&apos;s P2P compute mesh. We turned it into a turnkey sharding fabric for AI: layer-pipelined inference over AXL, packaged in prebuilt Docker images, and meshed with Tailscale so operators never expose a public port.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          <InnovCard color={X402}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", letterSpacing: "-0.01em" }}>Sharded inference over AXL</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, lineHeight: 1.55 }}>
              First production deployment of layer-pipelined LLM inference on the AXL transport. Hidden states cross AXL frames; sampled tokens come back the same way.
            </div>
            <div style={{ marginTop: "auto", paddingTop: 8 }}>
              <Pill color={X402} bg="rgba(251,191,36,0.12)">live · qwen-pool-1</Pill>
            </div>
          </InnovCard>

          <InnovCard color={ACCENT_BRIGHT}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", letterSpacing: "-0.01em" }}>One-line deploy</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, lineHeight: 1.55 }}>
              Prebuilt NVIDIA + CPU images bundle AXL, the worker, and CUDA. Operators run a single command — no toolchain.
            </div>
            <div style={{ marginTop: "auto", paddingTop: 8, padding: "8px 10px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, fontFamily: FONT_MONO, fontSize: 11, color: ACCENT_BRIGHT }}>
              $ docker compose up dis-com
            </div>
          </InnovCard>

          <InnovCard color={SUPER}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", letterSpacing: "-0.01em" }}>Tailscale-native</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT2, lineHeight: 1.55 }}>
              AXL traffic rides a Tailscale mesh. Zero exposed ports, zero firewall edits — operators stay invisible to the public internet.
            </div>
            <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", gap: 6, alignItems: "center", fontFamily: FONT_MONO, fontSize: 11, color: TEXT3 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: SUPER, animation: "pitch-pulse 1.6s ease-in-out infinite" }}/>
              0 ports open · WireGuard mesh
            </div>
          </InnovCard>
        </div>
      </div>
    ),
  },

  {
    id: "demo",
    label: "Live · running on 0G testnet",
    content: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
        <div>
          <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 56, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 28px" }}>
            A 4B model,<br/>two consumer cards.
          </h2>
          <p style={{ fontFamily: FONT_BODY, fontSize: 17, color: TEXT2, lineHeight: 1.55, marginBottom: 24, maxWidth: 520 }}>
            Live on 0G testnet: Qwen3-4B running across two RTX 4090s. Hidden states cross the AXL transport every ~90ms; the Superfluid meter ticks every 50ms. Both shards earn while the request is open.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: FONT_BODY, fontSize: 15, color: "#F4F4F0" }}>
            {[
              "Entry shard loads layers 0..17 (≈4 GB VRAM)",
              "Exit shard loads layers 18..35 + lm_head",
              "Each token: one forward hop, one token back",
              "11 tok/s sustained · meter stops on EOS",
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 18, height: 18, borderRadius: 9, background: ACCENT_DEEP, color: "#F4F4F0", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: FONT_MONO }}>{i + 1}</span>
                {s}
              </div>
            ))}
          </div>
        </div>
        <div><StreamDemo/></div>
      </div>
    ),
  },
  {
    id: "why-now",
    label: "Why now",
    content: (
      <div>
        <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 64, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 28px", maxWidth: 1100 }}>
          Open models small enough to shard.<br/>Consumer GPUs idle enough to host them.
        </h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 17, color: TEXT2, lineHeight: 1.5, marginBottom: 36, maxWidth: 920 }}>
          A 4B–8B open model in 2024 matches GPT-3.5 quality from 2023. Two prosumer GPUs can serve it together. The crypto crash left a glut of cards looking for a job. The pieces only just lined up.
        </p>
        <TimelineSVG/>
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 1100 }}>
          {[
            { t: "Open models hit production quality", d: "Llama-3.2, Qwen3 — 4B/8B params clear the bar that needed 175B in 2022." },
            { t: "Idle prosumer GPUs everywhere", d: "Post-mining 30/40-series cards and gaming rigs sit at <10% utilization." },
            { t: "Payment + transport rails ship", d: "x402 (HTTP 402) and Superfluid streams on 0G — settle and meter at second resolution." },
          ].map(c => (
            <div key={c.t}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", marginBottom: 8 }}>{c.t}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: TEXT2, lineHeight: 1.5 }}>{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "market",
    label: "Market",
    content: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
        <div>
          <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 64, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 28px" }}>
            Hundreds of millions<br/>of stranded GPUs.
          </h2>
          <p style={{ fontFamily: FONT_BODY, fontSize: 18, color: TEXT2, lineHeight: 1.55, marginBottom: 24 }}>
            The cloud sells you the only GPU big enough to fit your model. We turn the GPUs you already have into one big enough — together. The TAM is every consumer GPU not currently running production AI.
          </p>
          <div style={{ marginTop: 32 }}>
            <Stat value="$6.4B" label="serviceable obtainable market" sub="Decentralized inference on consumer GPUs, 2027 (a16z, Multicoin)" color={ACCENT_BRIGHT}/>
          </div>
        </div>
        <div><MarketSVG/></div>
      </div>
    ),
  },
  {
    id: "competition",
    label: "Competition",
    content: (
      <div>
        <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 56, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 16px" }}>
          The only network that shards.
        </h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 17, color: TEXT2, marginBottom: 36, maxWidth: 760 }}>
          Every other &quot;decentralized GPU&quot; product still requires the model to fit on one host. Together and Bedrock just resell big-iron capacity. We&apos;re the only ones letting two consumer cards behave like one production GPU.
        </p>
        <CompareTable/>
      </div>
    ),
  },
  {
    id: "roadmap",
    label: "Roadmap",
    content: (
      <div>
        <h2 className="pitch-h2-lg" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 56, color: "#F4F4F0", letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 32px" }}>
          From two-card splits to the full model frontier.
        </h2>
        <Roadmap/>
      </div>
    ),
  },
  {
    id: "ask",
    label: "The ask",
    content: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
        <div>
          <h2 className="pitch-h1" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 80, color: "#F4F4F0", letterSpacing: "-0.04em", lineHeight: 1.0, margin: "0 0 28px" }}>
            $4M seed.<br/>18 months.
          </h2>
          <p style={{ fontFamily: FONT_BODY, fontSize: 19, color: TEXT2, lineHeight: 1.55, marginBottom: 32, maxWidth: 520 }}>
            Push the sharded-inference frontier to 70B-class models on consumer rigs, scale to 250 operators across three regions, and grow streaming GMV to $40M/yr.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {([
              ["55%", "Sharding R&D · larger N-way splits", ACCENT_BRIGHT],
              ["25%", "Operator onboarding + GTM", SUPER],
              ["20%", "On-chain liquidity + audits", X402],
            ] as const).map(([pct, what, c]) => (
              <div key={what} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 32, color: c, width: 80, letterSpacing: "-0.02em" }}>{pct}</div>
                <div style={{ flex: 1, height: 8, background: SURFACE_2, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: pct, background: c }}/>
                </div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: "#F4F4F0", minWidth: 240 }}>{what}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: `linear-gradient(180deg, ${SURFACE}, ${BG})`, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 28 }}>
          <Eyebrow>Contact</Eyebrow>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT3 }}>Founder</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: "#F4F4F0", fontWeight: 600, marginTop: 4 }}>Philo & Freedan</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: TEXT2, marginTop: 2 }}>hello@philotheephilix.in</div>
            </div>
            <div style={{ height: 1, background: BORDER }}/>
            <div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT3 }}>Live product</div>
              <Link href="/" style={{ fontFamily: FONT_MONO, fontSize: 14, color: ACCENT_BRIGHT, textDecoration: "none", marginTop: 6, display: "inline-block" }}>computepool.vercel.app ↗</Link>
            </div>
            <div style={{ height: 1, background: BORDER }}/>
            <div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT3 }}>On-chain</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: TEXT2, marginTop: 6 }}>0G testnet · 0xCp00…1ED</div>
            </div>
          </div>
          <Link href="/" style={{
            display: "block", textAlign: "center", marginTop: 32,
            padding: "16px 24px", background: ACCENT_BRIGHT, color: BG,
            fontFamily: FONT_BODY, fontWeight: 600, fontSize: 15,
            borderRadius: 10, textDecoration: "none",
          }}>Try the live product →</Link>
        </div>
      </div>
    ),
  },
];

const PITCH_STYLES = `
  @keyframes pitch-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  @keyframes pitch-flow-dash { to { stroke-dashoffset: -60; } }
  .pitch-flow { animation: pitch-flow-dash 2s linear infinite; }
  @keyframes pitch-float-y { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-8px);} }
  @keyframes pitch-fade-in { to { opacity: 1; } }
  .pitch-fade-in { animation: pitch-fade-in 700ms ease forwards; opacity: 0; }
  .pitch-fade-in.delay-1 { animation-delay: 100ms; }
  .pitch-scroller::-webkit-scrollbar { display: none; }
  .pitch-root ::selection { background: rgba(165,180,252,0.3); color:#fff; }
  /* Base scaled-down sizes (overrides inline) */
  .pitch-root .pitch-h1 { font-size: 56px !important; }
  .pitch-root .pitch-h2 { font-size: 38px !important; }
  .pitch-root .pitch-h2-lg { font-size: 44px !important; }
  .pitch-root .pitch-stat { font-size: 56px !important; }
  @media (max-height: 820px) {
    .pitch-root .pitch-h1 { font-size: 48px !important; }
    .pitch-root .pitch-h2 { font-size: 32px !important; }
    .pitch-root .pitch-h2-lg { font-size: 38px !important; }
    .pitch-root .pitch-stat { font-size: 48px !important; }
  }
  @media (max-height: 700px) {
    .pitch-root .pitch-h1 { font-size: 40px !important; }
    .pitch-root .pitch-h2 { font-size: 28px !important; }
    .pitch-root .pitch-h2-lg { font-size: 32px !important; }
    .pitch-root .pitch-stat { font-size: 40px !important; }
  }
`;

export default function PitchPage() {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isScrolling = useRef(false);

  const goTo = useCallback((idx: number) => {
    const el = containerRef.current?.children[idx] as HTMLElement | undefined;
    if (el) {
      isScrolling.current = true;
      el.scrollIntoView({ behavior: "smooth" });
      setCurrent(idx);
      setTimeout(() => { isScrolling.current = false; }, 800);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); goTo(Math.min(current + 1, SLIDES.length - 1)); }
      if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); goTo(Math.max(current - 1, 0)); }
      if (e.key === "Home") { e.preventDefault(); goTo(0); }
      if (e.key === "End") { e.preventDefault(); goTo(SLIDES.length - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, goTo]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrolling.current) return;
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = Array.from(container.children).indexOf(entry.target);
            if (idx !== -1) setCurrent(idx);
          }
        });
      },
      { threshold: 0.55, root: container }
    );
    Array.from(container.children).forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pitch-root" style={{ position: "relative", background: BG, color: "#F4F4F0", height: "100vh", overflow: "hidden" }}>
      <style>{PITCH_STYLES}</style>

      {/* Minimal header — product name only, links home */}
      <div style={{ position: "fixed", top: 22, left: 32, zIndex: 60 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 12, textDecoration: "none" }} aria-label="Home">
          <svg width="28" height="28" viewBox="0 0 40 40">
            <polygon points="11.6,8 22.6,8 28.4,20 22.6,32 11.6,32 5.8,20" fill={ACCENT_BRIGHT}/>
            <polygon points="20.6,8 31.6,8 37.4,20 31.6,32 20.6,32 14.8,20" fill="#F4F4F0" fillOpacity="0.92"/>
          </svg>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: "#F4F4F0", letterSpacing: "-0.01em" }}>
            ComputePool
          </span>
        </Link>
      </div>

      {/* Dot nav */}
      <div style={{ position: "fixed", right: 24, top: "50%", transform: "translateY(-50%)", zIndex: 50, display: "flex", flexDirection: "column", gap: 10 }}>
        {SLIDES.map((s, i) => (
          <button key={s.id} onClick={() => goTo(i)} aria-label={s.id}
            style={{
              width: 6, height: current === i ? 22 : 6,
              padding: 0, border: "none",
              background: current === i ? ACCENT_BRIGHT : "rgba(255,255,255,0.18)",
              borderRadius: 999, cursor: "pointer",
              transition: "all 300ms ease",
            }}/>
        ))}
      </div>

      {/* Counter + label */}
      <div style={{ position: "fixed", bottom: 28, right: 32, zIndex: 50, fontFamily: FONT_MONO, fontSize: 11, color: TEXT3, letterSpacing: "0.1em", textAlign: "right" }}>
        <div>{String(current + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}</div>
        {SLIDES[current]?.label && <div style={{ marginTop: 4, color: TEXT2 }}>{SLIDES[current].label}</div>}
      </div>

      {current === 0 && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 50, fontFamily: FONT_MONO, fontSize: 11, color: TEXT3, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 8, animation: "pitch-float-y 2.4s ease-in-out infinite" }}>
          ↓ scroll · use arrow keys
        </div>
      )}

      <div ref={containerRef} className="pitch-scroller" style={{ height: "100vh", overflowY: "auto", scrollSnapType: "y mandatory", scrollbarWidth: "none" }}>
        {SLIDES.map((slide, i) => (
          <section key={slide.id}
            style={{ scrollSnapAlign: "start", minHeight: "100vh", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "72px 48px 56px", position: "relative", overflow: "hidden" }}>
            <div style={{ width: "100%", maxWidth: 1280 }}>
              {slide.label && (
                <div style={{ marginBottom: 32 }} className={current === i ? "pitch-fade-in" : ""}>
                  <Eyebrow>{slide.label}</Eyebrow>
                </div>
              )}
              <div className={current === i ? "pitch-fade-in delay-1" : ""} style={{ opacity: current === i ? undefined : 0.4, transition: "opacity 400ms" }}>
                {slide.content}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
