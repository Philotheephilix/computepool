"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_MESH_LINKS,
  DEFAULT_MESH_NODES,
  type MeshLinkState,
  type MeshNodeDef,
  type MeshNodeState,
} from "@/lib/constants";
import { MeshEdge } from "@/components/mesh/MeshEdge";
import { MeshNode } from "@/components/mesh/MeshNode";
import { useAXLStream } from "@/components/mesh/useAXLStream";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function AXLMesh() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredNodeIdx, setHoveredNodeIdx] = useState<number | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  const [nodeDefs] = useState<MeshNodeDef[]>(() => DEFAULT_MESH_NODES);
  const [nodeStates, setNodeStates] = useState<Record<string, MeshNodeState>>(() =>
    Object.fromEntries(DEFAULT_MESH_NODES.map((n) => [n.id, "idle"] as const)),
  );

  const [linkStates, setLinkStates] = useState<Record<string, MeshLinkState>>(() =>
    Object.fromEntries(
      DEFAULT_MESH_LINKS.map((l) => [`${l.a}-${l.b}`, "inactive"] as const),
    ),
  );

  const { events } = useAXLStream({ enabled: true });

  const activeChannels = useMemo(
    () =>
      Object.values(linkStates).reduce(
        (n, s) => n + (s === "active" ? 1 : 0),
        0,
      ),
    [linkStates],
  );

  useEffect(() => {
    if (events.length === 0) return;
    const last = events[events.length - 1];

    if (last.kind === "message") {
      const aIdx = nodeDefs.findIndex((n) => n.id === last.from);
      const bIdx = nodeDefs.findIndex((n) => n.id === last.to);
      if (aIdx >= 0 && bIdx >= 0) {
        const key =
          aIdx < bIdx ? `${aIdx}-${bIdx}` : `${bIdx}-${aIdx}`;
        setLinkStates((prev) => ({ ...prev, [key]: "active" }));
        window.setTimeout(() => {
          setLinkStates((prev) => ({ ...prev, [key]: "inactive" }));
        }, 650);
      }
    }

    if (last.kind === "node_state") {
      setNodeStates((prev) => ({ ...prev, [last.nodeId]: last.state }));
      if (last.ttlMs) {
        window.setTimeout(() => {
          setNodeStates((prev) => ({ ...prev, [last.nodeId]: "idle" }));
        }, last.ttlMs);
      }
    }
  }, [events, nodeDefs]);

  function onMouseMove(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  const tooltip = hoveredNodeIdx != null ? nodeDefs[hoveredNodeIdx] : null;
  const tooltipState =
    tooltip ? nodeStates[tooltip.id] ?? "idle" : null;
  const tooltipPos = useMemo(() => {
    if (!mouse) return null;
    const pad = 12;
    const w = 320;
    const h = 106;
    return {
      left: clamp(mouse.x + 14, pad, Math.max(pad, (containerRef.current?.clientWidth ?? 0) - w - pad)),
      top: clamp(mouse.y + 14, pad, Math.max(pad, (containerRef.current?.clientHeight ?? 0) - h - pad)),
      w,
    };
  }, [mouse]);

  return (
    <section
      className="border border-[var(--border)] bg-[var(--bg-panel)]"
      aria-label="AXL Mesh"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        <span>◆ AXL Mesh · Live</span>
        <div className="flex gap-[18px]">
          <span>
            Nodes{" "}
            <b className="ml-1 font-medium text-[var(--text)]">{nodeDefs.length}</b>
          </span>
          <span>
            Active channels{" "}
            <b className="ml-1 font-medium text-[var(--text)]">{activeChannels}</b>
          </span>
          <span>
            Jobs in flight <b className="ml-1 font-medium text-[var(--text)]">0</b>
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[180px]"
        onMouseMove={onMouseMove}
        onMouseLeave={() => {
          setHoveredNodeIdx(null);
          setMouse(null);
        }}
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 1200 180"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="AXL mesh graph"
        >
          {DEFAULT_MESH_LINKS.map((l, i) => {
            const A = nodeDefs[l.a];
            const B = nodeDefs[l.b];
            const key = `${l.a}-${l.b}`;
            return (
              <MeshEdge
                key={i}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                state={linkStates[key] ?? "inactive"}
              />
            );
          })}

          {nodeDefs.map((n, idx) => {
            const state = nodeStates[n.id] ?? "idle";
            return (
              <MeshNode
                key={n.id}
                id={n.id}
                x={n.x}
                y={n.y}
                state={state}
                onHover={() => setHoveredNodeIdx(idx)}
              />
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-3 left-4 flex gap-4 text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
          <LegendDot label="Idle" color="var(--text-faint)" />
          <LegendDot label="Bidding" color="var(--yellow)" />
          <LegendDot label="Coalition" color="var(--purple)" />
          <LegendDot label="Executing" color="var(--blue)" />
          <LegendDot label="Slashed" color="var(--red)" />
        </div>

        {/* Tooltip */}
        {tooltip && tooltipPos && (
          <div
            className="pointer-events-none absolute z-10 w-[320px] border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-2 text-[11px]"
            style={{ left: tooltipPos.left, top: tooltipPos.top }}
          >
            <div className="mb-1 flex items-baseline justify-between">
              <div className="text-[12px] font-medium text-[var(--text)]">
                {tooltip.id} <span className="ml-2 text-[var(--text-muted)]">{tooltip.role}</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
                {tooltipState}
              </div>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1 text-[var(--text-muted)]">
              <div className="text-[var(--text-faint)]">Reputation</div>
              <div className="text-[var(--text)]">{tooltip.reputation}%</div>
              <div className="text-[var(--text-faint)]">iNFT</div>
              <div className="text-[var(--text)]">{tooltip.tokenId}</div>
              <div className="text-[var(--text-faint)]">AXL peer</div>
              <div className="text-[var(--text)]">{tooltip.axlPeerId}</div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes meshDash {
          to {
            stroke-dashoffset: -10;
          }
        }
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(0, 255, 156, 0.7);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(0, 255, 156, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(0, 255, 156, 0);
          }
        }
      `}</style>
    </section>
  );
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

