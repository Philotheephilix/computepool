"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJobs, type StoredJob } from "@/lib/job-store";

const SOURCE_LABEL: Record<NonNullable<StoredJob["source"]>, string> = {
  "orchestrator": "orchestrator",
  "0g-compute":   "0G compute",
};

export function JobsListClient() {
  const [jobs, setJobs] = useState<StoredJob[]>([]);

  useEffect(() => {
    setJobs(loadJobs());
  }, []);

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 bg-[var(--bg-panel)]">
        <span className="text-[var(--text-faint)] font-mono text-[11px] uppercase tracking-[0.08em]">
          No jobs yet
        </span>
        <Link href="/jobs/new" className="text-[13px] text-[var(--green)] hover:underline">
          Post your first inference job →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-[var(--border)]">
      {jobs.map((j) => (
        <Link
          key={j.request_id}
          href={`/jobs/${j.request_id}`}
          className="grid grid-cols-[1fr_100px_100px_90px_80px] gap-4 px-4 py-3 bg-[var(--bg-panel)] hover:bg-[var(--bg-elev)] transition-colors items-center"
        >
          <span className="font-mono text-[12px] text-[var(--text)] truncate">{j.request_id}</span>
          <span className="font-mono text-[12px] text-[var(--text-muted)] truncate">{j.pool}</span>
          <span className="font-mono text-[12px] text-[var(--green)] tabular-nums">
            {j.cost_usdc.toFixed(6)}
          </span>
          <span className="font-mono text-[10px] px-2 py-1 rounded border border-[#00ff9c33] text-[var(--green)] bg-[#00ff9c0a] text-center">
            settled
          </span>
          <span className="font-mono text-[10px] text-[var(--text-faint)] truncate">
            {j.source ? SOURCE_LABEL[j.source] : "orchestrator"}
          </span>
        </Link>
      ))}
    </div>
  );
}
