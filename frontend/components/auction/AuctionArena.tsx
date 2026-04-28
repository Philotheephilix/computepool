"use client";

import { useJobEvents } from "@/hooks/useJobEvents";
import { JobCard } from "@/components/auction/JobCard";
import { LogStream } from "@/components/auction/LogStream";
import { LeadingBid } from "@/components/auction/LeadingBid";

export function AuctionArena() {
  const { job, rows, leading } = useJobEvents({ enabled: true });

  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--bg-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        <span>◆ Auction Arena</span>
        <div className="flex gap-[18px]">
          <span>
            Round <b className="ml-1 font-medium text-[var(--text)]">{job.round}</b>
          </span>
        </div>
      </div>

      <div className="flex h-[380px] flex-col">
        <JobCard job={job} />
        <LogStream rows={rows} />
        <LeadingBid leading={leading} />
      </div>

      <style jsx global>{`
        @keyframes auctionFadeIn {
          from {
            opacity: 0;
            transform: translateX(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </section>
  );
}

