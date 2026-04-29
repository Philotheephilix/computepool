"use client";

import { useState } from "react";
import Link from "next/link";
import { useApiState } from "@/hooks/useApiState";
import { pools as poolsApi, nodes as nodesApi, ApiError, type Pool, type Node } from "@/lib/api";
import { uploadJsonToStorage } from "@/lib/0g-storage";
import { getEthersSigner } from "@/lib/0g-compute";

// ── Status badges ─────────────────────────────────────────────────────────

const NODE_STATUS_COLOR: Record<string, string> = {
  registered: "var(--text-faint)",
  configured:  "var(--yellow)",
  loaded:      "var(--green)",
  unhealthy:   "var(--red)",
};

function poolStage(p: Pool): { label: string; color: string; step: number } {
  if (p.loaded)       return { label: "loaded",      color: "var(--green)",  step: 4 };
  if (p.initialized)  return { label: "initialized", color: "var(--blue)",   step: 3 };
  if (p.node_ids.length === 2) return { label: "has nodes", color: "var(--yellow)", step: 2 };
  return { label: "needs nodes", color: "var(--text-faint)", step: 1 };
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ── Small helpers ─────────────────────────────────────────────────────────

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="px-3 py-2 rounded border border-[#ff4f6e44] bg-[#ff4f6e0d] text-[11px] text-[var(--red)] mt-2">
      {msg}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  busy,
  variant = "ghost",
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  variant?: "ghost" | "green" | "red";
}) {
  const base = "px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.1em] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const cls =
    variant === "green"
      ? `${base} border-[#00ff9c44] text-[var(--green)] bg-[#00ff9c0a] hover:bg-[#00ff9c1a]`
      : variant === "red"
      ? `${base} border-[#ff4f6e44] text-[var(--red)] bg-[#ff4f6e0a] hover:bg-[#ff4f6e1a]`
      : `${base} border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-soft)] hover:text-[var(--text)]`;
  return (
    <button className={cls} onClick={onClick} disabled={busy}>
      {busy ? "…" : label}
    </button>
  );
}

// ── Initialize dialog ─────────────────────────────────────────────────────

function InitDialog({
  poolName,
  models,
  onDone,
  onClose,
}: {
  poolName: string;
  models: Record<string, number>;
  onDone: () => void;
  onClose: () => void;
}) {
  const modelKeys = Object.keys(models);
  const [model, setModel]   = useState(modelKeys[0] ?? "");
  const [price, setPrice]   = useState("0.0001");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await poolsApi.initialize(poolName, model, parseFloat(price));
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-sm flex flex-col gap-4 p-5 rounded border border-[var(--border-soft)] bg-[var(--bg-elev)]"
      >
        <h3 className="text-[14px] text-[var(--text)]" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          Initialize · {poolName}
        </h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text)] focus:outline-none"
          >
            {modelKeys.map((m) => (
              <option key={m} value={m}>{m} ({models[m]} layers)</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">Price / token (USDC)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.000001"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text)] focus:outline-none"
          />
        </div>

        {err && <ErrBox msg={err} />}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-[var(--border)] text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] rounded hover:border-[var(--border-soft)]">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="flex-1 py-2 bg-[var(--green)] text-black text-[10px] font-bold uppercase tracking-[0.12em] rounded hover:opacity-90 disabled:opacity-50">
            {busy ? "…" : "Initialize"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Add node dialog ───────────────────────────────────────────────────────

function AddNodeDialog({
  poolName,
  availableNodes,
  onDone,
  onClose,
}: {
  poolName: string;
  availableNodes: Node[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [nodeId, setNodeId] = useState(availableNodes[0]?.node_id ?? "");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await poolsApi.addNodes(poolName, [nodeId]);
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-sm flex flex-col gap-4 p-5 rounded border border-[var(--border-soft)] bg-[var(--bg-elev)]"
      >
        <h3 className="text-[14px] text-[var(--text)]" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          Add Node · {poolName}
        </h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">Node</label>
          {availableNodes.length === 0 ? (
            <p className="text-[11px] text-[var(--text-faint)]">No unassigned nodes available.</p>
          ) : (
            <select
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text)] focus:outline-none"
            >
              {availableNodes.map((n) => (
                <option key={n.node_id} value={n.node_id}>{n.node_id} · {n.status}</option>
              ))}
            </select>
          )}
        </div>

        {err && <ErrBox msg={err} />}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-[var(--border)] text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] rounded hover:border-[var(--border-soft)]">
            Cancel
          </button>
          <button type="submit" disabled={busy || availableNodes.length === 0} className="flex-1 py-2 bg-[var(--green)] text-black text-[10px] font-bold uppercase tracking-[0.12em] rounded hover:opacity-90 disabled:opacity-50">
            {busy ? "…" : "Add Node"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Bind to 0G Storage dialog ─────────────────────────────────────────────

function BindStorageDialog({
  pool,
  onClose,
}: {
  pool: Pool;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [errMsg, setErrMsg] = useState<string>("");

  async function handleBind() {
    setStatus("busy");
    setErrMsg("");

    const signer = await getEthersSigner();
    if (!signer) {
      setStatus("error");
      setErrMsg("No wallet connected. Connect MetaMask on the /connect page first.");
      return;
    }

    const metadata = {
      pool: pool.name,
      model: pool.model,
      nodes: pool.node_ids,
      price_per_token_usdc: pool.price_per_token_usdc,
      bound_at: new Date().toISOString(),
    };

    const result = await uploadJsonToStorage(metadata, signer);
    if (result.ok) {
      setTxHash(result.txHash);
      setStatus("done");
    } else {
      setErrMsg(result.error);
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm flex flex-col gap-4 p-5 rounded border border-[var(--border-soft)] bg-[var(--bg-elev)]">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] text-[var(--text)]" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            Bind to 0G Storage · {pool.name}
          </h3>
          <span className="px-1.5 py-0.5 rounded text-[8px] uppercase tracking-[0.1em] border border-[#00ff9c44] text-[var(--green)] bg-[#00ff9c0d]">
            real onchain
          </span>
        </div>

        <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
          Uploads pool metadata (model, nodes, price) to 0G Storage.
          Requires a connected wallet with testnet A0GI for gas.
        </p>

        <div className="flex flex-col gap-1 text-[10px] text-[var(--text-faint)]">
          <div className="flex gap-2"><span className="w-16 shrink-0">Pool</span><span className="text-[var(--text-muted)]">{pool.name}</span></div>
          <div className="flex gap-2"><span className="w-16 shrink-0">Model</span><span className="text-[var(--text-muted)]">{pool.model ?? "—"}</span></div>
          <div className="flex gap-2"><span className="w-16 shrink-0">Nodes</span><span className="text-[var(--text-muted)]">{pool.node_ids.length}</span></div>
        </div>

        {status === "done" && (
          <div className="flex flex-col gap-1 px-3 py-2 rounded border border-[#00ff9c44] bg-[#00ff9c0d]">
            <span className="text-[10px] text-[var(--green)] uppercase tracking-[0.1em]">Uploaded</span>
            <span className="text-[9px] text-[var(--green)] font-mono break-all">{txHash}</span>
          </div>
        )}

        {status === "error" && <ErrBox msg={errMsg} />}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-[var(--border)] text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] rounded hover:border-[var(--border-soft)]"
          >
            {status === "done" ? "Close" : "Cancel"}
          </button>
          {status !== "done" && (
            <button
              onClick={handleBind}
              disabled={status === "busy"}
              className="flex-1 py-2 bg-[var(--green)] text-black text-[10px] font-bold uppercase tracking-[0.12em] rounded hover:opacity-90 disabled:opacity-50"
            >
              {status === "busy" ? "Uploading…" : "Bind →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────

type Dialog =
  | { type: "init"; poolName: string }
  | { type: "addNode"; poolName: string }
  | { type: "bindStorage"; poolName: string; txHash?: string; error?: string };

export function OperatorClient() {
  const { data, loading, error, refresh } = useApiState();

  const [busy, setBusy]         = useState<Record<string, boolean>>({});
  const [err, setErr]           = useState<Record<string, string>>({});
  const [dialog, setDialog]     = useState<Dialog | null>(null);
  const [newPool, setNewPool]   = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr]   = useState<string | null>(null);

  function setBusyKey(k: string, v: boolean) {
    setBusy((b) => ({ ...b, [k]: v }));
  }
  function setErrKey(k: string, v: string) {
    setErr((e) => ({ ...e, [k]: v }));
  }
  function clearErrKey(k: string) {
    setErr((e) => { const n = { ...e }; delete n[k]; return n; });
  }

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusyKey(key, true);
    clearErrKey(key);
    try {
      await fn();
      refresh();
    } catch (e) {
      setErrKey(key, e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBusyKey(key, false);
    }
  }

  async function createPool(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    setCreateBusy(true);
    try {
      await poolsApi.create(newPool.trim());
      setNewPool("");
      setShowCreate(false);
      refresh();
    } catch (e) {
      setCreateErr(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setCreateBusy(false);
    }
  }

  if (error === "unauthenticated") {
    return (
      <div className="flex flex-col gap-3 p-5 rounded border border-[var(--border)] bg-[var(--bg-panel)] max-w-sm">
        <span className="text-[12px] text-[var(--text-muted)]">Sign in to access the operator dashboard.</span>
        <Link href="/connect" className="self-start px-4 py-2 bg-[var(--green)] text-black text-[10px] font-bold uppercase tracking-[0.12em] rounded hover:opacity-90">
          Sign In →
        </Link>
      </div>
    );
  }

  const nodes  = data?.nodes  ?? [];
  const pls    = data?.pools  ?? [];
  const mdls   = data?.models ?? {};

  const unassignedNodes = nodes.filter((n) => !n.pool_name);

  const summaryCards = [
    { label: "Nodes",        value: nodes.length,                                  color: "var(--text)" },
    { label: "Loaded Pools", value: pls.filter((p) => p.loaded).length,            color: "var(--green)" },
    { label: "Total Pools",  value: pls.length,                                    color: "var(--text)" },
    { label: "Models",       value: Object.keys(mdls).length,                      color: "var(--text)" },
  ];

  return (
    <>
      {dialog?.type === "init" && (
        <InitDialog
          poolName={dialog.poolName}
          models={mdls}
          onDone={() => { setDialog(null); refresh(); }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "addNode" && (
        <AddNodeDialog
          poolName={dialog.poolName}
          availableNodes={unassignedNodes}
          onDone={() => { setDialog(null); refresh(); }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "bindStorage" && (
        <BindStorageDialog
          pool={pls.find((p) => p.name === dialog.poolName)!}
          onClose={() => setDialog(null)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] text-[var(--text)]" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            Operator
          </h1>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {data ? `Signed in as ${data.user.username} · ` : ""}
            Refreshes every 10s
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-3 py-1.5 border border-[var(--border)] text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] rounded hover:border-[var(--border-soft)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {error && error !== "unauthenticated" && (
        <div className="mb-5 px-3 py-2 rounded border border-[#ff4f6e44] bg-[#ff4f6e0d] text-[11px] text-[var(--red)]">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {summaryCards.map((c) => (
          <div key={c.label} className="p-3 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-1">
            <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.12em]">{c.label}</span>
            <span className="text-[22px]" style={{ color: c.color }}>
              {loading ? "—" : c.value}
            </span>
          </div>
        ))}
      </div>

      {/* Nodes */}
      <section className="mb-8">
        <h2 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.12em] mb-3">Nodes</h2>
        <div className="rounded border border-[var(--border)] overflow-hidden">
          <div className="grid grid-cols-[1fr_90px_80px_80px_80px_120px_60px] gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-panel)]">
            {["Node ID", "Status", "Pool", "Role", "Layers", "Last Seen", ""].map((h) => (
              <span key={h} className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.1em]">{h}</span>
            ))}
          </div>

          {loading && !data ? (
            <div className="px-4 py-6 text-center text-[11px] text-[var(--text-faint)]">Loading…</div>
          ) : nodes.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11px] text-[var(--text-faint)]">
              No nodes registered. Workers register themselves on startup.
            </div>
          ) : (
            nodes.map((n) => (
              <div
                key={n.node_id}
                className="grid grid-cols-[1fr_90px_80px_80px_80px_120px_60px] gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 bg-[var(--bg-panel)] items-center"
              >
                <span className="text-[11px] text-[var(--text)] truncate">{n.node_id}</span>
                <span className="text-[10px]" style={{ color: NODE_STATUS_COLOR[n.status] ?? "var(--text-faint)" }}>
                  {n.status}
                </span>
                <span className="text-[10px] text-[var(--text-faint)] truncate">{n.pool_name ?? "—"}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{n.role ?? "—"}</span>
                <span className="text-[10px] text-[var(--text-faint)]">
                  {n.layers ? `${n.layers[0]}–${n.layers[1]}` : "—"}
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">{relTime(n.last_seen)}</span>
                <ActionBtn
                  label="Delete"
                  variant="red"
                  busy={busy[`del-node-${n.node_id}`]}
                  onClick={() =>
                    act(`del-node-${n.node_id}`, () => nodesApi.delete(n.node_id))
                  }
                />
              </div>
            ))
          )}
        </div>
        {err["del-node"] && <ErrBox msg={err["del-node"]} />}
      </section>

      {/* Pools */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.12em]">Pools</h2>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-3 py-1 border border-[var(--border)] text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] rounded hover:border-[var(--border-soft)] hover:text-[var(--text)] transition-colors"
          >
            {showCreate ? "Cancel" : "+ Create Pool"}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={createPool} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newPool}
              onChange={(e) => setNewPool(e.target.value)}
              placeholder="pool-name (a-z, 0-9, -, _)"
              required
              className="flex-1 px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-soft)]"
            />
            <button
              type="submit"
              disabled={createBusy}
              className="px-4 py-2 bg-[var(--green)] text-black text-[10px] font-bold uppercase tracking-[0.12em] rounded hover:opacity-90 disabled:opacity-50"
            >
              {createBusy ? "…" : "Create"}
            </button>
          </form>
        )}
        {createErr && <ErrBox msg={createErr} />}

        <div className="rounded border border-[var(--border)] overflow-hidden">
          <div className="grid grid-cols-[1fr_160px_80px_80px_80px_auto] gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-panel)]">
            {["Pool", "Model", "Nodes", "Price/tok", "Stage", "Actions"].map((h) => (
              <span key={h} className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.1em]">{h}</span>
            ))}
          </div>

          {loading && !data ? (
            <div className="px-4 py-6 text-center text-[11px] text-[var(--text-faint)]">Loading…</div>
          ) : pls.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11px] text-[var(--text-faint)]">No pools yet.</div>
          ) : (
            pls.map((p) => {
              const stage = poolStage(p);
              const keyPfx = `pool-${p.name}`;
              return (
                <div key={p.name} className="border-b border-[var(--border)] last:border-0 bg-[var(--bg-panel)]">
                  <div className="grid grid-cols-[1fr_160px_80px_80px_80px_auto] gap-3 px-4 py-3 items-center">
                    <span className="text-[11px] text-[var(--text)] truncate">{p.name}</span>
                    <span className="text-[10px] text-[var(--text-faint)] truncate">{p.model ?? "—"}</span>
                    <span className="text-[10px] text-[var(--text-faint)]">{p.node_ids.length} / 2</span>
                    <span className="text-[10px] text-[var(--text-faint)]">
                      {p.price_per_token_usdc != null ? `${p.price_per_token_usdc} USDC` : "—"}
                    </span>
                    <span className="text-[10px]" style={{ color: stage.color }}>{stage.label}</span>

                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {stage.step < 2 && (
                        <ActionBtn
                          label="Add Node"
                          busy={busy[`${keyPfx}-addnode`]}
                          onClick={() => setDialog({ type: "addNode", poolName: p.name })}
                        />
                      )}
                      {stage.step === 2 && (
                        <ActionBtn
                          label="Initialize"
                          busy={busy[`${keyPfx}-init`]}
                          onClick={() => setDialog({ type: "init", poolName: p.name })}
                        />
                      )}
                      {stage.step === 3 && (
                        <ActionBtn
                          label="Load"
                          variant="green"
                          busy={busy[`${keyPfx}-load`]}
                          onClick={() => act(`${keyPfx}-load`, () => poolsApi.load(p.name))}
                        />
                      )}
                      {stage.step === 4 && (
                        <>
                          <Link
                            href="/jobs/new"
                            className="px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.1em] border border-[#00ff9c44] text-[var(--green)] bg-[#00ff9c0a] hover:bg-[#00ff9c1a] transition-colors"
                          >
                            Infer
                          </Link>
                          <ActionBtn
                            label="0G Storage"
                            busy={busy[`${keyPfx}-bind`]}
                            onClick={() => setDialog({ type: "bindStorage", poolName: p.name })}
                          />
                          <ActionBtn
                            label="Unload"
                            busy={busy[`${keyPfx}-unload`]}
                            onClick={() => act(`${keyPfx}-unload`, () => poolsApi.unload(p.name))}
                          />
                        </>
                      )}
                      <ActionBtn
                        label="Delete"
                        variant="red"
                        busy={busy[`${keyPfx}-del`]}
                        onClick={() => act(`${keyPfx}-del`, () => poolsApi.delete(p.name))}
                      />
                    </div>
                  </div>

                  {(err[`${keyPfx}-load`] || err[`${keyPfx}-unload`] || err[`${keyPfx}-del`]) && (
                    <div className="px-4 pb-3">
                      <ErrBox
                        msg={
                          err[`${keyPfx}-load`] ??
                          err[`${keyPfx}-unload`] ??
                          err[`${keyPfx}-del`] ??
                          ""
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Models */}
      <section className="mt-8">
        <h2 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.12em] mb-3">Available Models</h2>
        <div className="flex flex-col gap-1.5">
          {Object.entries(mdls).map(([m, layers]) => (
            <div key={m} className="flex items-center justify-between px-4 py-2.5 rounded border border-[var(--border)] bg-[var(--bg-panel)]">
              <span className="text-[12px] text-[var(--text)]">{m}</span>
              <span className="text-[10px] text-[var(--text-faint)]">{layers} layers</span>
            </div>
          ))}
          {!loading && Object.keys(mdls).length === 0 && (
            <span className="text-[11px] text-[var(--text-faint)] px-4">—</span>
          )}
        </div>
      </section>
    </>
  );
}
