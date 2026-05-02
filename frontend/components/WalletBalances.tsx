"use client";

import { useEffect, useRef, useState } from "react";
import { readSuperTokenBalance } from "@/lib/sepolia-rpc";

interface Member {
  label: string;
  address: `0x${string}`;
}

interface Props {
  superToken: `0x${string}`;
  members: Member[];
  pollMs?: number;
}

function balancesEqual(a: Record<string, bigint>, b: Record<string, bigint>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

export function WalletBalances({ superToken, members, pollMs = 1000 }: Props) {
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const balancesRef = useRef(balances);
  balancesRef.current = balances;

  const memberKey = members.map((m) => m.address).join(",");

  useEffect(() => {
    let stop = false;
    async function tick() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const previous = balancesRef.current;
      const next: Record<string, bigint> = {};
      await Promise.all(
        members.map(async (m) => {
          try {
            next[m.address] = await readSuperTokenBalance(superToken, m.address);
          } catch {
            next[m.address] = previous[m.address] ?? 0n;
          }
        }),
      );
      if (stop) return;
      setBalances((prev) => (balancesEqual(prev, next) ? prev : next));
    }
    const t = setInterval(tick, pollMs);
    tick();
    return () => {
      stop = true;
      clearInterval(t);
    };
    // memberKey is a stable string identity for the address list; using it as a dep
    // avoids tearing down the interval when the parent re-creates the array literal.
  }, [superToken, memberKey, pollMs]); // eslint-disable-line react-hooks/exhaustive-deps

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
