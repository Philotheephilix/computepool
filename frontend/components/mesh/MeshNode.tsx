"use client";

import type { MeshNodeState } from "@/lib/constants";
import { MESH_NODE_COLORS } from "@/lib/constants";

export function MeshNode({
  id,
  x,
  y,
  state,
  onHover,
}: {
  id: string;
  x: number;
  y: number;
  state: MeshNodeState;
  onHover: () => void;
}) {
  const col = MESH_NODE_COLORS[state];

  return (
    <g
      transform={`translate(${x},${y})`}
      onMouseEnter={onHover}
      onFocus={onHover}
    >
      <circle
        r={col.r}
        fill={col.fill}
        stroke={col.stroke}
        strokeWidth={1.5}
        className="transition-[fill,stroke,r] duration-300"
      />
      <text y={24} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>
        {id}
      </text>
    </g>
  );
}

