"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pools as poolsApi, type Pool, type InferResponse, ApiError } from "@/lib/api";
import { saveJob } from "@/lib/job-store";
import { loadAuth } from "@/lib/auth-store";

function InferResult({ result }: { result: InferResponse }) {
  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-2">
        <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">Response</span>
        <p className="text-[14px] text-[var(--text)] leading-relaxed whitespace-pre-wrap">
          {result.text ?? "(empty)"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Tokens",   value: result.tokens ?? "—" },
          { label: "Elapsed",  value: result.elapsed_s != null ? `${result.elapsed_s.toFixed(2)}s` : "—" },
          { label: "TPS",      value: result.tokens_per_sec != null ? result.tokens_per_sec.toFixed(1) : "—" },
          { label: "Cost",     value: `${result.cost_usdc.toFixed(6)} USDC` },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded border border-[var(--border)] bg-[var(--bg-elev)] flex flex-col gap-0.5">
            <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">{s.label}</span>
            <span className="font-mono text-[14px] text-[var(--green)] tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 px-1">
        {[
          ["Pool",       result.pool],
          ["Entry node", result.entry_node],
          ["Exit node",  result.exit_node],
          ["Request ID", result.request_id],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-[11px]">
            <span className="font-mono text-[var(--text-faint)] uppercase tracking-[0.08em] w-20 shrink-0">{k}</span>
            <span className="font-mono text-[var(--text-muted)] truncate">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function JobForm() {
  const [authed, setAuthed]         = useState<boolean | null>(null);
  const [poolList, setPoolList]     = useState<Pool[]>([]);
  const [loadingPools, setLoadingPools] = useState(true);

  const [poolName, setPoolName]     = useState("");
  const [prompt, setPrompt]         = useState("");
  const [maxTokens, setMaxTokens]   = useState(64);
  const [temperature, setTemperature] = useState(0.7);

  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed]       = useState(0);
  const [result, setResult]         = useState<InferResponse | null>(null);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const a = loadAuth();
    if (!a) { setAuthed(false); setLoadingPools(false); return; }
    setAuthed(true);
    poolsApi.list()
      .then((ps) => {
        const loaded = ps.filter((p) => p.loaded);
        setPoolList(loaded);
        if (loaded.length > 0) setPoolName(loaded[0].name);
      })
      .catch(() => {})
      .finally(() => setLoadingPools(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    setElapsed(0);

    const start = Date.now();
    const ticker = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);

    try {
      const res = await poolsApi.infer(poolName, prompt, maxTokens, temperature);
      saveJob(res);
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Request failed.");
    } finally {
      clearInterval(ticker);
      setSubmitting(false);
    }
  }

  if (authed === false) {
    return (
      <div className="p-5 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-3">
        <span className="text-[14px] text-[var(--text-muted)]">Sign in to post an inference job.</span>
        <Link href="/connect" className="self-start px-4 py-2 bg-[var(--green)] text-black font-mono text-[10px] font-bold uppercase tracking-[0.08em] rounded hover:opacity-90 transition-opacity">
          Sign In →
        </Link>
      </div>
    );
  }

  if (!loadingPools && poolList.length === 0) {
    return (
      <div className="p-5 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-3">
        <span className="text-[14px] text-[var(--text-muted)]">No loaded pools available.</span>
        <span className="text-[13px] text-[var(--text-faint)] leading-relaxed">
          Set up and load a pool in the Operator dashboard before running inference.
        </span>
        <Link href="/operator" className="self-start px-4 py-2 border border-[var(--border-soft)] text-[var(--text-muted)] font-mono text-[10px] uppercase tracking-[0.08em] rounded hover:border-[var(--border)] hover:text-[var(--text)] transition-colors">
          Go to Operator →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em]">Pool</label>
        {loadingPools ? (
          <div className="h-10 rounded border border-[var(--border)] bg-[var(--bg-panel)] animate-pulse" />
        ) : (
          <select
            value={poolName}
            onChange={(e) => setPoolName(e.target.value)}
            required
            className="px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--border-soft)] transition-colors appearance-none"
          >
            {poolList.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} · {p.model ?? "—"} · {p.node_ids.length} nodes
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em]">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt…"
          required
          rows={4}
          className="px-3 py-3 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[14px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-soft)] transition-colors resize-none leading-relaxed"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em]">
            Max Tokens <span className="text-[var(--text-faint)] tabular-nums">({maxTokens})</span>
          </label>
          <input
            type="range"
            min={1}
            max={512}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="accent-[var(--green)]"
          />
          <div className="flex justify-between font-mono text-[10px] text-[var(--text-faint)] tabular-nums">
            <span>1</span><span>512</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em]">
            Temperature <span className="text-[var(--text-faint)] tabular-nums">({temperature.toFixed(1)})</span>
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="accent-[var(--green)]"
          />
          <div className="flex justify-between font-mono text-[10px] text-[var(--text-faint)] tabular-nums">
            <span>0.0</span><span>2.0</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded border border-[#ff4f6e44] bg-[#ff4f6e0d] text-[13px] text-[var(--red)]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || loadingPools}
        className="py-3 bg-[var(--green)] text-black font-mono text-[11px] font-bold uppercase tracking-[0.08em] rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? `Running inference… ${elapsed}s` : "Run Inference →"}
      </button>

      {result && <InferResult result={result} />}
    </form>
  );
}
