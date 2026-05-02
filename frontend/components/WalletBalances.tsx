"use client";

import { useEffect, useState } from "react";
import { readSuperTokenBalance } from "@/lib/sepolia-rpc";

interface Member {
  label: string;          // "node-a"
  address: `0x${string}`;
}

interface Props {
  superToken: `0x${string}`;
  members: Member[];
  pollMs?: number;
}

export function WalletBalances({ superToken, members, pollMs = 1000 }: Props) {
  const [balances, setBalances] = useState<Record<string, bigint>>({});

  useEffect(() => {
    let stop = false;
    async function tick() {
      const next: Record<string, bigint> = {};
      await Promise.all(
        members.map(async (m) => {
          try {
            next[m.address] = await readSuperTokenBalance(superToken, m.address);
          } catch {
            next[m.address] = balances[m.address] ?? 0n;
          }
        })
      );
      if (!stop) setBalances(next);
    }
    const t = setInterval(tick, pollMs);
    tick();
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [superToken, members, pollMs]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {members.map((m) => {
        const b = balances[m.address] ?? 0n;
        const human = (Number(b) / 1e18).toFixed(6);
        return (
          <div key={m.address} className="rounded border p-3">
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="font-mono text-sm">{m.address.slice(0, 10)}…</div>
            <div className="font-mono text-2xl tabular-nums">{human}</div>
            <div className="text-xs text-muted-foreground">USDCx</div>
          </div>
        );
      })}
    </div>
  );
}
