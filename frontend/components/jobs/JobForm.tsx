"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { pools as poolsApi, type Pool, type InferResponse, ApiError } from "@/lib/api";
import { saveJob } from "@/lib/job-store";
import { saveReputation } from "@/lib/reputation";
import { loadAuth } from "@/lib/auth-store";

const USE_0G = process.env.NEXT_PUBLIC_USE_0G_COMPUTE === "1";

async function computeActivationHash(
  text: string | null,
  timings: Record<string, unknown> | null,
): Promise<string | null> {
  if (!text || typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const raw = text + JSON.stringify(timings);
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

async function infer0g(
  prompt: string,
  maxTokens: number,
  temperature: number,
): Promise<InferResponse> {
  const resp = await fetch("/api/infer-0g", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, max_tokens: maxTokens, temperature }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new ApiError(resp.status, (body as { error?: string }).error ?? resp.statusText);
  }
  return resp.json() as Promise<InferResponse>;
}

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
          { label: "Tokens",  value: result.tokens ?? "—" },
          { label: "Elapsed", value: result.elapsed_s != null ? `${result.elapsed_s.toFixed(2)}s` : "—" },
          { label: "TPS",     value: result.tokens_per_sec != null ? result.tokens_per_sec.toFixed(1) : "—" },
          { label: "Cost",    value: `${result.cost_usdc.toFixed(6)} USDC` },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded border border-[var(--border)] bg-[var(--bg-elev)] flex flex-col gap-0.5">
            <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">{s.label}</span>
            <span className="font-mono text-[14px] text-[var(--green)] tabular-nums">{String(s.value)}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 px-1">
        {([
          ["Pool",       result.pool],
          ["Entry node", result.entry_node],
          ["Exit node",  result.exit_node],
          ["Request ID", result.request_id],
        ] as [string, string][]).map(([k, v]) => (
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
  const searchParams   = useSearchParams();
  const poolFromQuery  = searchParams.get("pool");

  const [authed, setAuthed]             = useState<boolean | null>(null);
  const [poolList, setPoolList]         = useState<Pool[]>([]);
  const [loadingPools, setLoadingPools] = useState(true);

  const [poolName, setPoolName]         = useState("");
  const [prompt, setPrompt]             = useState("");
  const [maxTokens, setMaxTokens]       = useState(64);
  const [temperature, setTemperature]   = useState(0.7);

  const [submitting, setSubmitting]     = useState(false);
  const [elapsed, setElapsed]           = useState(0);
  const [result, setResult]             = useState<InferResponse | null>(null);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    const a = loadAuth();
    if (!a) { setAuthed(false); setLoadingPools(false); return; }
    setAuthed(true);
    poolsApi.list()
      .then((ps) => {
        const loaded = ps.filter((p) => p.loaded);
        setPoolList(loaded);
        const preferred = poolFromQuery ? loaded.find((p) => p.name === poolFromQuery) : null;
        setPoolName(preferred ? preferred.name : loaded.length > 0 ? loaded[0].name : "");
      })
      .catch(() => {})
      .finally(() => setLoadingPools(false));
  }, [poolFromQuery]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    setElapsed(0);

    const start  = Date.now();
    const ticker = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);

    try {
      const res = USE_0G
        ? await infer0g(prompt, maxTokens, temperature)
        : await poolsApi.infer(poolName, prompt, maxTokens, temperature);

      const activationHash = await computeActivationHash(res.text, res.timings);
      const source: "orchestrator" | "0g-compute" = USE_0G ? "0g-compute" : "orchestrator";
      const sla_met = res.elapsed_s != null ? res.elapsed_s < 60 : true;
      const ts = new Date().toISOString();

      saveJob({ ...res, activationHash: activationHash ?? undefined, source });

      saveReputation(res.entry_node, { won: true, sla_met, timestamp: ts });
      if (res.exit_node !== res.entry_node) {
        saveReputation(res.exit_node, { won: true, sla_met, timestamp: ts });
      }

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
        <Link
          href="/connect"
          className="self-start px-4 py-2 bg-[var(--green)] text-black font-mono text-[10px] font-bold uppercase tracking-[0.08em] rounded hover:opacity-90 transition-opacity"
        >
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
        <Link
          href="/operator"
          className="self-start px-4 py-2 border border-[var(--border-soft)] text-[var(--text-muted)] font-mono text-[10px] uppercase tracking-[0.08em] rounded hover:border-[var(--border)] hover:text-[var(--text)] transition-colors"
        >
          Go to Operator →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {USE_0G && (
        <div className="px-3 py-2 rounded border border-[#b39dff44] bg-[#b39dff0d] font-mono text-[10px] text-[#b39dff] uppercase tracking-[0.08em]">
          Routing via 0G Compute Network
        </div>
      )}

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
            type="range" min={1} max={512} value={maxTokens}
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
            type="range" min={0} max={2} step={0.1} value={temperature}
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
