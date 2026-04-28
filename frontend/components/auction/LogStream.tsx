"use client";

import { useEffect, useRef } from "react";
import type { AuctionLogRow } from "@/components/auction/types";
import { LogRow } from "@/components/auction/LogRow";

export function LogStream({ rows }: { rows: AuctionLogRow[] }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  return (
    <div ref={ref} className="flex-1 overflow-y-auto py-2">
      {rows.map((r) => (
        <LogRow key={r.id} row={r} />
      ))}
    </div>
  );
}

