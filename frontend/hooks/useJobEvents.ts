"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AuctionJob,
  AuctionLeading,
  AuctionLogRow,
} from "@/components/auction/types";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function tSince(startMs: number) {
  const s = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

export function useJobEvents({ enabled = true }: { enabled?: boolean }) {
  const startMs = useRef<number>(Date.now());
  const seq = useRef(0);

  const [job] = useState<AuctionJob>(() => ({
    round: "#247",
    jobId: "job_0x91c4",
    model: "Llama-7B",
    budgetEth: "0.95",
    deadline: "30s",
  }));

  const [leading, setLeading] = useState<AuctionLeading>(() => ({
    leadingBid: "—",
    leadingCoalition: "—",
  }));

  const [rows, setRows] = useState<AuctionLogRow[]>(() => []);

  const push = (row: Omit<AuctionLogRow, "id">) => {
    seq.current += 1;
    const id = `${Date.now()}-${seq.current}`;
    setRows((prev) => {
      const next = [...prev, { ...row, id }];
      return next.length > 200 ? next.slice(-200) : next;
    });
  };

  useEffect(() => {
    if (!enabled) return;

    startMs.current = Date.now();
    setRows([]);
    setLeading({ leadingBid: "—", leadingCoalition: "—" });

    const timers: number[] = [];
    const timer = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timers.push(id);
    };

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "client",
        agentTone: "b",
        verb: "POST_JOB",
        body: `${job.model} · max ${job.budgetEth} ETH · deadline ${job.deadline}`,
      });
    }, 600);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "shard-1",
        verb: "OFFER",
        body: "0.42 ETH · layers 0–10",
      });
    }, 1400);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "shard-2",
        verb: "COUNTER",
        body: "0.36 ETH · layers 0–10 ⚡",
      });
      setLeading({ leadingBid: "0.36 ETH", leadingCoalition: "shard-2" });
    }, 2000);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "shard-4",
        verb: "OFFER",
        body: "0.30 ETH · layers 11–20",
      });
    }, 2600);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "shard-2",
        agentTone: "p",
        verb: "COALITION_INVITE",
        body: "→ shard-4, shard-7, shard-8",
      });
    }, 3200);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "shard-4",
        agentTone: "p",
        verb: "JOIN",
        body: "layers 11–20 · 0.30 ETH",
      });
    }, 3800);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "shard-7",
        agentTone: "p",
        verb: "JOIN",
        body: "layers 21–30 · 0.32 ETH",
      });
    }, 4300);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "shard-8",
        agentTone: "p",
        verb: "JOIN",
        body: "layers 31–32 · 0.05 ETH",
      });
      setLeading({ leadingBid: "0.97 ETH", leadingCoalition: "A · 4 shards" });
    }, 4800);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "coalition-A",
        agentTone: "p",
        verb: "BID",
        body: "0.97 ETH · 4 shards · 28s SLA",
      });
    }, 5300);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "coalition-B",
        agentTone: "p",
        verb: "COUNTER",
        body: "0.91 ETH · 3 shards · 30s SLA",
      });
      setLeading({ leadingBid: "0.91 ETH", leadingCoalition: "B · 3 shards" });
    }, 5800);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "coalition-A",
        agentTone: "p",
        verb: "BID",
        body: "0.88 ETH · 4 shards · 25s SLA ⚡",
      });
      setLeading({ leadingBid: "0.88 ETH", leadingCoalition: "A · 4 shards" });
    }, 6300);

    timer(() => {
      push({
        t: tSince(startMs.current),
        agent: "matchmaker",
        agentTone: "b",
        verb: "WIN",
        body: "coalition-A @ 0.88 ETH · contract committed",
        win: true,
      });
    }, 6900);

    // Loop after a short pause so it stays alive like the demo reference.
    timer(() => {
      startMs.current = Date.now();
      setRows([]);
      setLeading({ leadingBid: "—", leadingCoalition: "—" });
    }, 22000);

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [enabled, job.deadline, job.budgetEth, job.model]);

  return useMemo(() => ({ job, leading, rows }), [job, leading, rows]);
}

