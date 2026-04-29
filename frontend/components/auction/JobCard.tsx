"use client";

import type { AuctionJob } from "@/components/auction/types";

export function JobCard({ job }: { job: AuctionJob }) {
  const awaiting = job.jobId === "awaiting…";

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg-elev)] px-4 py-3.5">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
        Incoming job
      </div>
      <div
        className="font-mono text-[16px] text-[var(--green)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {job.jobId}
      </div>
      <div className="mt-2 flex gap-[18px] text-[12px] text-[var(--text-muted)]">
        <span>
          <b className="font-medium text-[var(--text)]">{job.model}</b> model
        </span>
        <span>
          budget{" "}
          <b className="font-mono font-medium text-[var(--text)] tabular-nums">
            {awaiting ? "— ETH" : `${job.budgetEth} ETH`}
          </b>
        </span>
        <span>
          deadline{" "}
          <b className="font-mono font-medium text-[var(--text)] tabular-nums">{job.deadline}</b>
        </span>
      </div>
    </div>
  );
}
