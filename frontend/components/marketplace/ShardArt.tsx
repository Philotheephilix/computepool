import type { LayerGroup } from "@/lib/marketplace";
import { LAYER_GROUP_COLOR } from "@/lib/marketplace";

export function ShardArt({
  num,
  layerGroup,
  size = 80,
}: {
  num: string;
  layerGroup: LayerGroup;
  size?: number;
}) {
  const accent = LAYER_GROUP_COLOR[layerGroup];
  const uid = `shard-art-${num}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={`${uid}-grad`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16161a" />
          <stop offset="100%" stopColor="#0a0a0b" />
        </linearGradient>
        <pattern id={`${uid}-grid`} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 4 H8 M4 0 V8" stroke="#1f1f24" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect width="80" height="80" fill={`url(#${uid}-grad)`} />
      <rect width="80" height="80" fill={`url(#${uid}-grid)`} />

      <rect x="14" y="14" width="52" height="52" fill="#0a0a0b" stroke={accent} strokeWidth="1" />
      <rect x="20" y="20" width="40" height="40" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.35" />

      <text
        x="40"
        y="35"
        textAnchor="middle"
        fill={accent}
        fontSize="5.5"
        fontWeight="500"
        letterSpacing="1.5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        SHARD
      </text>
      <text
        x="40"
        y="51"
        textAnchor="middle"
        fill="var(--text)"
        fontSize="16"
        fontStyle="italic"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {num}
      </text>

      <g stroke={accent} strokeWidth="0.8" opacity="0.7">
        <line x1="14" y1="24" x2="6"  y2="24" />
        <line x1="14" y1="36" x2="6"  y2="36" />
        <line x1="14" y1="48" x2="6"  y2="48" />
        <line x1="66" y1="24" x2="74" y2="24" />
        <line x1="66" y1="36" x2="74" y2="36" />
        <line x1="66" y1="48" x2="74" y2="48" />
      </g>
    </svg>
  );
}
