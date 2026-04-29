"use client";

export function StatCards({
  tokenCount,
  payoutEth,
  hashCount,
}: {
  tokenCount: number;
  payoutEth: number;
  hashCount: number;
}) {
  return (
    <div className="mt-[18px] grid grid-cols-3 gap-3">
      <div className="border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-2.5">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
          Output tokens
        </div>
        <div className="font-mono text-[16px] text-[var(--text)] tabular-nums">
          {tokenCount}
          <span className="ml-1 text-[11px] text-[var(--text-muted)]">streamed</span>
        </div>
      </div>
      <div className="border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-2.5">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
          <span className="mr-1 text-[var(--green)]">◆</span>
          KeeperHub payouts
        </div>
        <div className="font-mono text-[16px] text-[var(--green)] tabular-nums">
          {payoutEth.toFixed(3)}
          <span className="ml-1 text-[11px] text-[var(--text-muted)]">ETH</span>
        </div>
      </div>
      <div className="border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-2.5">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
          Activation hashes
        </div>
        <div className="font-mono text-[16px] text-[var(--text)] tabular-nums">
          {hashCount}
          <span className="ml-1 text-[11px] text-[var(--text-muted)]">on 0G</span>
        </div>
      </div>
    </div>
  );
}
