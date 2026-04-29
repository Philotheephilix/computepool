"use client";

import type { AuctionJob, AuctionLeading, AuctionLogRow } from "@/components/auction/types";
import { JobCard } from "@/components/auction/JobCard";
import { LogStream } from "@/components/auction/LogStream";
import { LeadingBid } from "@/components/auction/LeadingBid";

export function AuctionArena({
  job,
  rows,
  leading,
}: {
  job: AuctionJob;
  rows: AuctionLogRow[];
  leading: AuctionLeading;
}) {
  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--bg-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <span>◆ Auction Arena</span>
        <div className="flex gap-[18px]">
          <span>
            Round <b className="ml-1 font-medium text-[var(--text)] tabular-nums">{job.round}</b>
          </span>
        </div>
      </div>

      <div className="flex h-[380px] flex-col">
        <JobCard job={job} />
        <LogStream rows={rows} />
        <LeadingBid leading={leading} />
      </div>
    </section>
  );
}
