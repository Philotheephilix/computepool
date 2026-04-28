"use client";

import type { AuctionJob } from "@/components/auction/types";

export function JobCard({ job }: { job: AuctionJob }) {
  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg-elev)] px-4 py-3.5">
      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
        Incoming job
      </div>
      <div
        className="text-[18px] italic text-[var(--green)]"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {job.jobId}
      </div>
      <div className="mt-2 flex gap-[18px] text-[11px] text-[var(--text-muted)]">
        <span>
          <b className="font-medium text-[var(--text)]">{job.model}</b> model
        </span>
        <span>
          budget{" "}
          <b className="font-medium text-[var(--text)]">{job.budgetEth} ETH</b>
        </span>
        <span>
          deadline{" "}
          <b className="font-medium text-[var(--text)]">{job.deadline}</b>
        </span>
      </div>
    </div>
  );
}

