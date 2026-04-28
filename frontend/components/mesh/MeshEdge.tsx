"use client";

import type { MeshLinkState } from "@/lib/constants";

export function MeshEdge({
  x1,
  y1,
  x2,
  y2,
  state,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: MeshLinkState;
}) {
  const isActive = state === "active";
  const isCoalition = state === "coalition";

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      strokeDasharray="3 4"
      className={[
        "transition-[stroke,stroke-width] duration-300",
        isActive ? "stroke-[var(--green)] stroke-[1.4] [animation:meshDash_1s_linear_infinite]" : "",
        isCoalition ? "stroke-[var(--purple)] stroke-[2]" : "",
        !isActive && !isCoalition ? "stroke-[var(--border-soft)] stroke-[1]" : "",
      ].join(" ")}
    />
  );
}

