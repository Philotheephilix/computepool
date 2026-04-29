"use client";

const LAST_TX_HREF =
  "https://etherscan.io/tx/0xc4f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8";

export function RoyaltyCard({ royaltyEth }: { royaltyEth: number }) {
  return (
    <div className="border-l border-[var(--border-soft)] pl-6 max-md:border-l-0 max-md:border-t max-md:border-[var(--border-soft)] max-md:pl-0 max-md:pt-3.5">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
        Royalty earnings{" "}
        <span className="ml-1.5 inline-flex items-center gap-1.5 text-[10px] normal-case tracking-normal text-[var(--green)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)] [animation:pulse_1.6s_infinite]" />
          live
        </span>
      </div>
      <div className="font-mono text-[32px] font-medium tabular-nums tracking-[-0.02em] text-[var(--green)]">
        {royaltyEth.toFixed(4)}
        <span className="ml-1 text-[14px] text-[var(--text-muted)]">ETH</span>
      </div>
      <div className="mt-1.5 text-[12px] text-[var(--text-muted)]">
        last tx:{" "}
        <a
          href={LAST_TX_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-dashed border-[var(--blue)] font-mono text-[var(--blue)]"
        >
          0xc4f…e217
        </a>{" "}
        via KeeperHub
      </div>
    </div>
  );
}
