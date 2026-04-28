"use client";

import type { AuctionLogRow } from "@/components/auction/types";

function agentToneClass(tone: AuctionLogRow["agentTone"]) {
  if (tone === "b") return "text-[var(--blue)]";
  if (tone === "p") return "text-[var(--purple)]";
  if (tone === "r") return "text-[var(--red)]";
  return "text-[var(--yellow)]";
}

export function LogRow({ row }: { row: AuctionLogRow }) {
  const base =
    "flex items-baseline gap-3 px-4 py-1 text-[12px] leading-[1.6] [animation:auctionFadeIn_0.25s_ease]";

  const winTone = row.win ? "text-[var(--green)] font-bold" : "";
  const verbTone = row.win ? "text-[var(--green)] font-bold" : "text-[var(--text-muted)]";

  return (
    <div className={[base, row.win ? "text-[var(--green)]" : ""].join(" ")}>
      <span className="min-w-[38px] text-[10px] text-[var(--text-faint)]">
        {row.t}
      </span>
      <span className={["min-w-[90px]", agentToneClass(row.agentTone)].join(" ")}>
        {row.agent}
      </span>
      <span
        className={[
          "min-w-[110px] text-[10px] uppercase tracking-[0.08em]",
          verbTone,
        ].join(" ")}
      >
        {row.verb}
      </span>
      <span className={["flex-1 text-[var(--text)]", winTone].join(" ")}>
        {row.body}
      </span>
    </div>
  );
}

