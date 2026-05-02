"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJob, type StoredJob } from "@/lib/job-store";
import { useApiState } from "@/hooks/useApiState";

const OG_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai";

function StoryboardRibbon() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded border border-[#ff9c0033] bg-[#ff9c000a]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#ff9c00] shrink-0" />
      <span className="font-mono text-[10px] text-[#ff9c00] uppercase tracking-[0.08em]">
        storyboard · AXL pipeline routing is illustrative, not live telemetry
      </span>
    </div>
  );
}

export function JobDetailClient({ id }: { id: string }) {
  const [job, setJob] = useState<StoredJob | null | "loading">("loading");
  const { data: apiData } = useApiState();

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
          className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em] hover:text-[var(--text-muted)] transition-colors"
        >
          ← My Jobs
        </Link>
        <div className="p-5 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-3">
          <span className="text-[14px] text-[var(--text-muted)]">Job not found.</span>
          <span className="text-[13px] text-[var(--text-faint)] leading-relaxed">
            ID <code className="font-mono">{id}</code> was not found in local storage.
            Jobs are stored for your 50 most recent inferences.
          </span>
          <Link
            href="/jobs/new"
            className="self-start px-4 py-2 border border-[var(--border-soft)] text-[var(--text-muted)] font-mono text-[10px] uppercase tracking-[0.08em] rounded hover:border-[var(--border)] hover:text-[var(--text)] transition-colors"
          >
            Post a Job →
          </Link>
        </div>
      </div>
    );
  }

  // Cross-look-up real peer IDs and layer assignments from live state
  const nodeMap = new Map((apiData?.nodes ?? []).map((n) => [n.node_id, n]));
  const entryNode = nodeMap.get(job.entry_node);
  const exitNode  = nodeMap.get(job.exit_node);
  const entryPeer = entryNode?.axl_peer_id ?? null;
  const exitPeer  = exitNode?.axl_peer_id ?? null;

  const pool = apiData?.pools?.find((p) => p.name === job.pool);
  const entryLayers = pool?.assignments?.find((a) => a.node_id === job.entry_node)?.layers;
  const exitLayers  = pool?.assignments?.find((a) => a.node_id === job.exit_node)?.layers;

  const entryLabel = entryPeer
    ? `${entryPeer.slice(0, 12)}…`
    : `${job.entry_node.slice(0, 12)}…`;
  const exitLabel = exitPeer
    ? `${exitPeer.slice(0, 12)}…`
    : `${job.exit_node.slice(0, 12)}…`;

  const sourceLabel = job.source === "0g-compute" ? "0G Compute" : "orchestrator";

  return (
    <div className="px-8 py-8 max-w-2xl flex flex-col gap-6">
      <div>
        <Link
          href="/jobs"
          className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em] hover:text-[var(--text-muted)] transition-colors mb-4 block"
        >
          ← My Jobs
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className="text-[30px] leading-tight text-[var(--text)]"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            Inference Result
          </h1>
          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] uppercase tracking-[0.08em] border border-[#0088ff44] text-[#0088ff] bg-[#0088ff0d]">
            real backend
          </span>
        </div>
        <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
          {new Date(job.created_at).toLocaleString()} · pool:{" "}
          <span className="font-mono">{job.pool}</span> · via {sourceLabel}
        </p>
      </div>

      {/* Response */}
      <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-2">
        <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">Response</span>
        <p className="text-[14px] text-[var(--text)] leading-relaxed whitespace-pre-wrap">
          {job.text ?? "(empty)"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Tokens",  value: job.tokens ?? "—" },
          { label: "Elapsed", value: job.elapsed_s != null ? `${job.elapsed_s.toFixed(2)}s` : "—" },
          { label: "TPS",     value: job.tokens_per_sec != null ? job.tokens_per_sec.toFixed(1) : "—" },
          { label: "Cost",    value: `${job.cost_usdc.toFixed(6)} USDC` },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded border border-[var(--border)] bg-[var(--bg-elev)] flex flex-col gap-0.5">
            <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">{s.label}</span>
            <span className="font-mono text-[14px] text-[var(--green)] tabular-nums">{String(s.value)}</span>
          </div>
        ))}
      </div>

      {/* Routing */}
      <div className="flex flex-col gap-1 px-1">
        {([
          ["Pool",       job.pool],
          ["Entry node", `${job.entry_node}${entryLayers ? ` · L ${entryLayers[0]}–${entryLayers[1]}` : ""}`],
          ["Exit node",  `${job.exit_node}${exitLayers ? ` · L ${exitLayers[0]}–${exitLayers[1]}` : ""}`],
          ["Request ID", job.request_id],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-[11px]">
            <span className="font-mono text-[var(--text-faint)] uppercase tracking-[0.08em] w-20 shrink-0">{k}</span>
            <span className="text-[var(--text-muted)] truncate font-mono">{v}</span>
          </div>
        ))}
      </div>

      {/* Activation hash */}
      {job.activationHash && (
        <div className="flex items-center gap-2 px-1 text-[11px]">
          <span className="font-mono text-[var(--text-faint)] uppercase tracking-[0.08em] w-20 shrink-0">Activation</span>
          <a
            href={`${OG_INDEXER}/?hash=${job.activationHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[var(--green)] truncate hover:underline"
          >
            {job.activationHash.slice(0, 16)}…
          </a>
        </div>
      )}

      {/* AXL Pipeline */}
      <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-3">
        <StoryboardRibbon />
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">AXL Pipeline</span>
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
            <span className="font-mono px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-elev)]">{entryLabel}</span>
            <span>→ AXL encrypted →</span>
            <span className="font-mono px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-elev)]">{exitLabel}</span>
          </div>
          {(entryPeer || exitPeer) && (
            <div className="flex flex-col gap-0.5 text-[11px]">
              {entryPeer && (
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em] w-16 shrink-0">Entry peer</span>
                  <span className="font-mono text-[var(--text-muted)] break-all">{entryPeer}</span>
                </div>
              )}
              {exitPeer && (
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em] w-16 shrink-0">Exit peer</span>
                  <span className="font-mono text-[var(--text-muted)] break-all">{exitPeer}</span>
                </div>
              )}
            </div>
          )}
          <p className="text-[12px] text-[var(--text-faint)] leading-relaxed">
            Activation tensors were routed peer-to-peer through the AXL mesh. DA anchoring via 0G DA requires a running DA client.
          </p>
        </div>
      </div>

      <p className="font-mono text-[10px] text-[var(--text-faint)]">
        Live data: orchestrator · 0G Galileo · 0G Storage
      </p>
    </div>
  );
}
