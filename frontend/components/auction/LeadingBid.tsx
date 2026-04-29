"use client";

import type { AuctionLeading } from "@/components/auction/types";

export function LeadingBid({ leading }: { leading: AuctionLeading }) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-elev)] px-4 py-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
          Leading bid
        </span>
        <span className="font-mono text-[16px] font-medium text-[var(--green)] tabular-nums">
          {leading.leadingBid}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 text-right">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
          Coalition
        </span>
        <span className="font-mono text-[13px] text-[var(--text-muted)]">
          {leading.leadingCoalition}
        </span>
      </div>
    </div>
  );
}
