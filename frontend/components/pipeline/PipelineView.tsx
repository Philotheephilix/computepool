"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PIPELINE_SHARDS } from "@/lib/pipeline";
import { PipelineShard } from "@/components/pipeline/PipelineShard";
import { StatCards } from "@/components/pipeline/StatCards";
import { SlashBanner } from "@/components/pipeline/SlashBanner";
import type { ActivationParticle } from "@/components/pipeline/types";
import type { PipelineShardState } from "@/components/pipeline/types";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function PipelineView({
  tps,
  curLayer,
  tokenCount,
  payoutEth,
  hashCount,
  shardStates,
  slashVisible,
  particles,
}: {
  tps: number;
  curLayer: string;
  tokenCount: number;
  payoutEth: number;
  hashCount: number;
  shardStates: Record<string, PipelineShardState>;
  slashVisible: boolean;
  particles: ActivationParticle[];
}) {
  const [renderParticles, setRenderParticles] = useState<ActivationParticle[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setRenderParticles(particles);
  }, [particles]);

  useEffect(() => {
    const tick = () => {
      setRenderParticles((p) => p);
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const arrows = useMemo(() => {
    const y = 100;
    return PIPELINE_SHARDS.slice(0, -1).map((s, i) => {
      const x1 = s.x + 80;
      const x2 = PIPELINE_SHARDS[i + 1].x;
      return { key: `${s.id}-${PIPELINE_SHARDS[i + 1].id}`, x1, x2, y };
    });
  }, []);

  return (
    <section className="relative overflow-hidden border border-[var(--border)] bg-[var(--bg-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <span>◆ Pipeline Execution</span>
        <div className="flex gap-[18px]">
          <span>
            Tokens/s <b className="ml-1 font-medium text-[var(--text)] tabular-nums">{tps}</b>
          </span>
          <span>
            Layer <b className="ml-1 font-medium text-[var(--text)] tabular-nums">{curLayer}</b>
          </span>
        </div>
      </div>

      <div className="relative flex h-[380px] flex-col px-4 py-6">
        <svg
          className="h-[200px] w-full"
          viewBox="0 0 700 200"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6" fill="var(--border-soft)" />
            </marker>
          </defs>

          {arrows.map((a) => (
            <path
              key={a.key}
              d={`M ${a.x1} ${a.y} L ${a.x2 - 6} ${a.y}`}
              stroke="var(--border-soft)"
              strokeWidth={1.5}
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          ))}

          {PIPELINE_SHARDS.map((s) => (
            <PipelineShard
              key={s.id}
              x={s.x}
              y={70}
              id={s.id}
              label={s.label}
              state={shardStates[s.id] ?? "idle"}
            />
          ))}

          {renderParticles.map((p) => {
            const fromX = PIPELINE_SHARDS[p.fromIdx]?.x ?? 0;
            const toX = PIPELINE_SHARDS[p.toIdx]?.x ?? 0;
            const x1 = fromX + 80;
            const x2 = toX;
            const now = Date.now();
            const t = Math.min(1, Math.max(0, (now - p.startMs) / p.durationMs));
            const cx = lerp(x1, x2, t);
            return (
              <circle
                key={p.id}
                cx={cx}
                cy={100}
                r={4}
                className={
                  p.failed
                    ? "fill-[var(--red)] [filter:drop-shadow(0_0_4px_var(--red))]"
                    : "fill-[var(--green)] [filter:drop-shadow(0_0_4px_var(--green))]"
                }
              />
            );
          })}
        </svg>

        <StatCards
          tokenCount={tokenCount}
          payoutEth={payoutEth}
          hashCount={hashCount}
        />

        <SlashBanner visible={slashVisible} />
      </div>
    </section>
  );
}
