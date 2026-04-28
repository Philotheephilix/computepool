"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type AxlEvent =
  | {
      kind: "message";
      from: string;
      to: string;
    }
  | {
      kind: "node_state";
      nodeId: string;
      state: "idle" | "bidding" | "coalition" | "executing" | "slashed" | "done";
      ttlMs?: number;
    }
  | {
      kind: "node_killed";
      nodeId: string;
      replacementNodeId?: string;
    };

// Mock stream that feels like "live AXL" without a backend.
// Later we can replace the interval with an actual WebSocket client.
export function useAXLStream({ enabled = true }: { enabled?: boolean }) {
  const [events, setEvents] = useState<AxlEvent[]>([]);
  const seq = useRef(0);

  const push = (ev: AxlEvent) => {
    setEvents((prev) => {
      const next = [...prev, ev];
      return next.length > 24 ? next.slice(-24) : next;
    });
  };

  useEffect(() => {
    if (!enabled) return;

    const nodes = [
      "shard-1",
      "shard-2",
      "shard-3",
      "shard-4",
      "shard-5",
      "shard-6",
      "shard-7",
      "shard-8",
    ];

    const interval = window.setInterval(() => {
      seq.current += 1;
      const i = seq.current;

      // Every ~12 ticks, create a tiny "failure + reroute" beat.
      if (i % 12 === 0) {
        push({ kind: "node_killed", nodeId: "shard-3", replacementNodeId: "shard-5" });
        push({ kind: "node_state", nodeId: "shard-3", state: "slashed", ttlMs: 900 });
        push({ kind: "message", from: "shard-2", to: "shard-4" });
        push({ kind: "message", from: "shard-4", to: "shard-5" });
        push({ kind: "node_state", nodeId: "shard-5", state: "executing", ttlMs: 1200 });
        return;
      }

      // Otherwise just send a message between random peers.
      const a = nodes[Math.floor(Math.random() * nodes.length)];
      let b = nodes[Math.floor(Math.random() * nodes.length)];
      if (b === a) b = nodes[(nodes.indexOf(a) + 1) % nodes.length];

      push({ kind: "message", from: a, to: b });

      // Occasionally set a transient node state so colors move.
      const roll = Math.random();
      if (roll > 0.7) {
        const state = roll > 0.92 ? "executing" : roll > 0.83 ? "coalition" : "bidding";
        push({ kind: "node_state", nodeId: a, state, ttlMs: 1400 });
      }
    }, 700);

    return () => window.clearInterval(interval);
  }, [enabled]);

  const value = useMemo(() => ({ events }), [events]);
  return value;
}

