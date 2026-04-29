"use client";

import { INFTArt } from "@/components/wallet/INFTArt";
import { RoyaltyCard } from "@/components/wallet/RoyaltyCard";
import { ReputationCard } from "@/components/wallet/ReputationCard";

export function INFTWallet({
  royaltyEth,
  repWinPct,
  repSlaPct,
  repWinWarn,
  repHistory,
}: {
  royaltyEth: number;
  repWinPct: number;
  repSlaPct: number;
  repWinWarn: boolean;
  repHistory: string;
}) {
  return (
    <section className="mt-[18px] grid grid-cols-1 items-center gap-6 border border-[var(--border)] bg-[var(--bg-panel)] p-[18px] md:grid-cols-[200px_1fr_1fr_220px] md:gap-6">
      <INFTArt />
      <div>
        <h3
          className="mb-1.5 text-[26px] font-normal italic leading-tight text-[var(--text)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Shard-07 · Llama-7B · layers 21–30
        </h3>
        <div className="mb-3.5 text-[12px] text-[var(--text-muted)]">
          iNFT{" "}
          <b className="font-mono font-normal text-[var(--blue)]">0xA73f…891c · #07</b> ·
          ERC-7857
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] text-[var(--text-muted)]">
          <span className="flex gap-2 before:content-['✓'] before:text-[var(--green)]">
            Embedded weights on 0G Storage (encrypted)
          </span>
          <span className="flex gap-2 before:content-['✓'] before:text-[var(--green)]">
            Negotiation policy v1.4 (LoRA, 8MB)
          </span>
          <span className="flex gap-2 before:content-['✓'] before:text-[var(--green)]">
            Reputation persisted in 0G Storage Log
          </span>
          <span className="flex gap-2 before:content-['✓'] before:text-[var(--green)]">
            Royalty splits onchain
          </span>
        </div>
      </div>
      <RoyaltyCard royaltyEth={royaltyEth} />
      <ReputationCard
        winPct={repWinPct}
        slaPct={repSlaPct}
        winWarn={repWinWarn}
        history={repHistory}
      />
    </section>
  );
}
