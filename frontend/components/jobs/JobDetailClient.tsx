"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJob, type StoredJob } from "@/lib/job-store";

function RealPill() {
  return (
    <span className="px-1.5 py-0.5 rounded text-[8px] uppercase tracking-[0.1em] border border-[#0088ff44] text-[#0088ff] bg-[#0088ff0d]">
      real backend
    </span>
  );
}

export function JobDetailClient({ id }: { id: string }) {
  const [job, setJob] = useState<StoredJob | null | "loading">("loading");

  useEffect(() => {
    setJob(loadJob(id));
  }, [id]);

  if (job === "loading") {
    return (
      <div className="px-8 py-8">
        <div className="h-4 w-32 rounded bg-[var(--bg-elev)] animate-pulse" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="px-8 py-8 flex flex-col gap-4 max-w-xl">
        <Link
          href="/jobs"
          className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.14em] hover:text-[var(--text-muted)] transition-colors"
        >
          ← My Jobs
        </Link>
        <div className="p-5 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-3">
          <span className="text-[12px] text-[var(--text-muted)]">Job not found.</span>
          <span className="text-[11px] text-[var(--text-faint)] leading-relaxed">
            ID <code className="font-mono">{id}</code> was not found in local storage.
            Jobs are stored for your 50 most recent inferences.
          </span>
          <Link
            href="/jobs/new"
            className="self-start px-4 py-2 border border-[var(--border-soft)] text-[var(--text-muted)] text-[10px] uppercase tracking-[0.12em] rounded hover:border-[var(--border)] hover:text-[var(--text)] transition-colors"
          >
            Post a Job →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-2xl flex flex-col gap-6">
      <div>
        <Link
          href="/jobs"
          className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.14em] hover:text-[var(--text-muted)] transition-colors mb-4 block"
        >
          ← My Jobs
        </Link>
        <div className="flex items-center gap-3">
          <h1
            className="text-[22px] text-[var(--text)]"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            Inference Result
          </h1>
          <RealPill />
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
          {new Date(job.created_at).toLocaleString()} · pool: {job.pool}
        </p>
      </div>

      {/* Response text */}
      <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-2">
        <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.12em]">Response</span>
        <p className="text-[13px] text-[var(--text)] leading-relaxed whitespace-pre-wrap">
          {job.text ?? "(empty)"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Tokens",    value: job.tokens ?? "—" },
          { label: "Elapsed",   value: job.elapsed_s != null ? `${job.elapsed_s.toFixed(2)}s` : "—" },
          { label: "TPS",       value: job.tokens_per_sec != null ? job.tokens_per_sec.toFixed(1) : "—" },
          { label: "Cost",      value: `${job.cost_usdc.toFixed(6)} USDC` },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded border border-[var(--border)] bg-[var(--bg-elev)] flex flex-col gap-0.5">
            <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.1em]">{s.label}</span>
            <span className="text-[14px] text-[var(--green)]">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Routing info */}
      <div className="flex flex-col gap-1 px-1">
        {[
          ["Pool",       job.pool],
          ["Entry node", job.entry_node],
          ["Exit node",  job.exit_node],
          ["Request ID", job.request_id],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-[10px]">
            <span className="text-[var(--text-faint)] w-20 shrink-0">{k}</span>
            <span className="text-[var(--text-muted)] truncate font-mono">{v}</span>
          </div>
        ))}
      </div>

      {/* Storyboard overlay */}
      <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.12em]">AXL Pipeline</span>
          <span className="px-1.5 py-0.5 rounded text-[8px] uppercase tracking-[0.1em] border border-[#ff9c0044] text-[#ff9c00] bg-[#ff9c000d]">simulated</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)]">
          <span className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-elev)]">{job.entry_node.slice(0, 12)}…</span>
          <span>→ AXL encrypted →</span>
          <span className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-elev)]">{job.exit_node.slice(0, 12)}…</span>
        </div>
        <p className="text-[9px] text-[var(--text-faint)] leading-relaxed">
          Activation tensors were routed peer-to-peer through the AXL mesh. DA anchoring via 0G DA requires a running DA client.
        </p>
      </div>
    </div>
  );
}
