"use client";

import * as React from "react";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "./theme";
import { FlowLine } from "./primitives";

export function NetworkGraph({
  width = 760,
  height = 520,
  nodeCount = 7,
  breachId = null,
  breachAt = null,
  compact = false,
}: {
  width?: number;
  height?: number;
  nodeCount?: number;
  breachId?: number | null;
  breachAt?: number | null;
  compact?: boolean;
}) {
  const T = useT();
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let raf: number;
    const loop = () => {
      setTick((t) => t + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cx = width / 2, cy = height / 2;
  const R = Math.min(width, height) * 0.34;
  const workers = React.useMemo(() => {
    return Array.from({ length: nodeCount }, (_, i) => {
      const a = (Math.PI * 2 * i) / nodeCount + Math.PI * 0.5;
      void a;
      return {
        id: `node-${String.fromCharCode(97 + i)}`,
        baseAngle: (Math.PI * 2 * i) / nodeCount + Math.PI * 0.5,
        radius: R * (0.85 + Math.abs(Math.cos(i * 1.3)) * 0.3),
        phase: i * 0.6,
      };
    });
  }, [nodeCount, R]);

  const t = tick / 60;
  const breached = breachAt != null && t > breachAt;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <radialGradient id="cp-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={T.primary} stopOpacity="0.18"/>
          <stop offset="60%" stopColor={T.primary} stopOpacity="0.04"/>
          <stop offset="100%" stopColor={T.primary} stopOpacity="0"/>
        </radialGradient>
        <pattern id="cp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={T.border} strokeWidth="0.5" opacity="0.5"/>
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#cp-grid)" opacity="0.6"/>
      <circle cx={cx} cy={cy} r={R * 1.4} fill="url(#cp-glow)"/>

      {workers.map((w, i) => {
        const drift = Math.sin(t * 0.4 + w.phase) * 0.04;
        const a = w.baseAngle + drift;
        const x = cx + w.radius * Math.cos(a);
        const y = cy + w.radius * Math.sin(a);
        const isBreached = breached && i === (breachId ?? -1);
        return (
          <g key={"e" + i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={T.border} strokeWidth="1" opacity="0.55"/>
            {!isBreached && i % 2 === 0 && (
              <FlowLine d={`M ${cx} ${cy} L ${x} ${y}`}/>
            )}
          </g>
        );
      })}

      {workers.map((w, i) => {
        const drift = Math.sin(t * 0.4 + w.phase) * 0.04;
        const a = w.baseAngle + drift;
        const x = cx + w.radius * Math.cos(a);
        const y = cy + w.radius * Math.sin(a);
        const isBreached = breached && i === (breachId ?? -1);
        const pulse = 1 + 0.06 * Math.sin(t * 2 + w.phase);
        const r = (compact ? 11 : 14) * pulse;
        return (
          <g key={"n" + i}>
            {!isBreached && (
              <circle cx={x} cy={y} r={r + 7} fill={T.primaryLight} opacity={0.7}/>
            )}
            <circle cx={x} cy={y} r={r} fill={isBreached ? T.red : T.primary}/>
            {!compact && (
              <text x={x} y={y + r + 18} textAnchor="middle"
                fontFamily={FONT_MONO} fontSize="11" fill={T.text2}>{w.id}</text>
            )}
          </g>
        );
      })}

      {workers.map((w, i) => {
        if (i % 2 !== 0) return null;
        const drift = Math.sin(t * 0.4 + w.phase) * 0.04;
        const a = w.baseAngle + drift;
        const ex = cx + w.radius * Math.cos(a);
        const ey = cy + w.radius * Math.sin(a);
        const phase = ((t * 0.5 + i * 0.25) % 1);
        const px = cx + (ex - cx) * phase;
        const py = cy + (ey - cy) * phase;
        return <circle key={"p" + i} cx={px} cy={py} r="2.5" fill={T.primary} opacity={1 - phase * 0.5}/>;
      })}

      <g>
        <circle cx={cx} cy={cy} r={(compact ? 20 : 26) + Math.sin(t * 1.4) * 3} fill={T.text1} opacity="0.07"/>
        <circle cx={cx} cy={cy} r={compact ? 16 : 22} fill={T.text1}/>
        <text x={cx} y={cy + 5} textAnchor="middle"
          fontFamily={FONT_DISPLAY} fontSize={compact ? 12 : 14} fontWeight="600" fill={T.bg}>◆</text>
        {!compact && (
          <text x={cx} y={cy + 48} textAnchor="middle"
            fontFamily={FONT_BODY} fontSize="12" fontWeight="500" fill={T.text2}>orchestrator</text>
        )}
      </g>
    </svg>
  );
}
