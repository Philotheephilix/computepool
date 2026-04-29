"use client";

import type { PipelineShardState } from "@/components/pipeline/types";
import { MESH_NODE_COLORS } from "@/lib/constants";

const stateToMeshKey: Record<PipelineShardState, keyof typeof MESH_NODE_COLORS> =
  {
    idle: "idle",
    executing: "executing",
    slashed: "slashed",
    done: "done",
  };

export function PipelineShard({
  x,
  y,
  id,
  label,
  state,
  width = 80,
  height = 60,
}: {
  x: number;
  y: number;
  id: string;
  label: string;
  state: PipelineShardState;
  width?: number;
  height?: number;
}) {
  const col = MESH_NODE_COLORS[stateToMeshKey[state]];

  return (
    <g transform={`translate(${x}, ${y})`} data-shard-id={id}>
      <rect
        width={width}
        height={height}
        fill={col.fill}
        stroke={col.stroke}
        strokeWidth={1.5}
        className="transition-[stroke,fill] duration-300"
      />
      <text
        x={width / 2}
        y={26}
        textAnchor="middle"
        fill="var(--text)"
        fontSize={11}
        fontWeight={500}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {id}
      </text>
      <text
        x={width / 2}
        y={44}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize={10}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </text>
      <circle cx={width - 10} cy={12} r={3} fill={col.stroke} />
    </g>
  );
}

