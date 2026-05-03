"use client";

import * as React from "react";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { Badge, Button, Card, RowKV } from "@/components/cp/primitives";
import { useApiState } from "@/lib/use-api-state";
import { pools as poolsApi, type Pool } from "@/lib/api";
import { useBreakpoint } from "@/lib/use-breakpoint";

const COLS = "1.4fr 1.2fr 0.7fr 0.5fr 0.7fr 0.7fr 1fr";

function poolState(p: Pool): { label: string; kind: "primary" | "amber" | "offline" | "purple" } {
  if (p.loaded) return { label: "LOADED",      kind: "primary" };
  if (p.initialized) return { label: "INITIALIZED", kind: "purple" };
  if (p.node_ids.length > 0) return { label: "STAGED", kind: "amber" };
  return { label: "EMPTY", kind: "offline" };
}

export default function DashPools() {
  const T = useT();
  const isMobile = useBreakpoint();
  const { data, authed, refresh, error } = useApiState({ pollMs: 5_000 });
  const [open, setOpen] = React.useState<Pool | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [opErr, setOpErr] = React.useState<string | null>(null);

  if (!authed) {
    return <Card padding={32}>Sign in at <a href="/connect" style={{ color: T.primary }}>/connect</a> first.</Card>;
  }
  const pools = data?.pools ?? [];
  const models = data?.models ?? {};
  const nodes = data?.nodes ?? [];

  const create = async () => {
    setOpErr(null);
    setBusy(true);
    try {
      await poolsApi.create(newName.trim());
      setNewName("");
      setCreating(false);
      await refresh();
    } catch (e) {
      setOpErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doInitialize = async (p: Pool, model: string, price: number) => {
    setOpErr(null); setBusy(true);
    try { await poolsApi.initialize(p.name, model, price); await refresh(); }
    catch (e) { setOpErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const doLoad = async (p: Pool) => {
    setOpErr(null); setBusy(true);
    try { await poolsApi.load(p.name); await refresh(); }
    catch (e) { setOpErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const doUnload = async (p: Pool) => {
    setOpErr(null); setBusy(true);
    try { await poolsApi.unload(p.name); await refresh(); }
    catch (e) { setOpErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const doDelete = async (p: Pool) => {
    if (!confirm(`Delete pool ${p.name}?`)) return;
    setOpErr(null); setBusy(true);
    try { await poolsApi.delete(p.name); setOpen(null); await refresh(); }
    catch (e) { setOpErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const doAddNode = async (p: Pool, nodeId: string) => {
    setOpErr(null); setBusy(true);
    try { await poolsApi.addNodes(p.name, [nodeId]); await refresh(); }
    catch (e) { setOpErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: isMobile ? 24 : 32, color: T.text1, letterSpacing: "-0.02em", margin: 0 }}>Pools</h1>
        <Button kind="primary" onClick={() => setCreating(true)}>+ New pool</Button>
      </div>
      {error && <Card padding={16} style={{ marginBottom: 16, background: T.redLight, border: `1px solid ${T.red}` }}><span style={{ color: T.red, fontFamily: FONT_MONO, fontSize: 13 }}>{error}</span></Card>}
      {opErr && <Card padding={16} style={{ marginBottom: 16, background: T.redLight, border: `1px solid ${T.red}` }}><span style={{ color: T.red, fontFamily: FONT_MONO, fontSize: 13 }}>{opErr}</span></Card>}

      {creating && (
        <Card padding={20} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="pool-name"
              style={{ flex: 1, minWidth: 160, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text1, fontFamily: FONT_BODY, fontSize: 14 }}/>
            <Button kind="primary" disabled={!newName.trim() || busy} onClick={create}>{busy ? "Creating…" : "Create"}</Button>
            <Button kind="ghost" onClick={() => { setCreating(false); setNewName(""); }}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card padding={0} style={{ overflow: "hidden" }}>
        {/* Desktop: column header */}
        {!isMobile && (
          <div style={{
            display: "grid", gridTemplateColumns: COLS, padding: "14px 22px",
            borderBottom: `1px solid ${T.border}`,
            fontFamily: FONT_BODY, fontSize: 12, color: T.text3, fontWeight: 500,
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            <span>Pool</span><span>Model</span><span>State</span><span>Nodes</span>
            <span>Price</span><span>Created</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>
        )}

        {pools.length === 0 && (
          <div style={{ padding: 24, fontFamily: FONT_BODY, fontSize: 13, color: T.text3 }}>
            No pools yet. Create one above, then add 2 nodes and initialize a model.
          </div>
        )}

        {pools.map((p) => {
          const st = poolState(p);
          const created = p.created_at ? new Date(p.created_at).toLocaleDateString() : "—";
          return isMobile ? (
            <div key={p.name} onClick={() => setOpen(p)}
              style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: T.text1, fontWeight: 600 }}>{p.name}</span>
                <Badge kind={st.kind} label={st.label}/>
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text2, marginBottom: 8 }}>
                {p.model ?? "—"} · {p.node_ids.length} node{p.node_ids.length !== 1 ? "s" : ""}
                {p.price_per_token_usdc != null ? ` · ${p.price_per_token_usdc.toFixed(4)} USDC/tok` : ""}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3 }}>{created}</span>
                <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {!p.loaded && p.initialized && <Button kind="secondary" onClick={() => doLoad(p)}>Load</Button>}
                  {p.loaded && <Button kind="secondary" onClick={() => doUnload(p)}>Unload</Button>}
                </div>
              </div>
            </div>
          ) : (
            <div key={p.name} onClick={() => setOpen(p)}
              style={{
                display: "grid", gridTemplateColumns: COLS, padding: "16px 22px",
                borderBottom: `1px solid ${T.border}`, alignItems: "center", cursor: "pointer",
              }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.text1 }}>{p.name}</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text2 }}>{p.model ?? "—"}</span>
              <Badge kind={st.kind} label={st.label}/>
              <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.text2 }}>{p.node_ids.length}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.text2 }}>{p.price_per_token_usdc != null ? `${p.price_per_token_usdc.toFixed(4)} USDC` : "—"}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text3 }}>{created}</span>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}
                onClick={(e) => e.stopPropagation()}>
                {!p.loaded && p.initialized && <Button kind="secondary" onClick={() => doLoad(p)}>Load</Button>}
                {p.loaded && <Button kind="secondary" onClick={() => doUnload(p)}>Unload</Button>}
              </div>
            </div>
          );
        })}
      </Card>

      {open && (
        <PoolDetail
          pool={open}
          models={models}
          availableNodes={nodes.filter((n) => !open.node_ids.includes(n.node_id))}
          onClose={() => setOpen(null)}
          onInitialize={doInitialize}
          onAddNode={doAddNode}
          onLoad={() => doLoad(open)}
          onUnload={() => doUnload(open)}
          onDelete={() => doDelete(open)}
          busy={busy}
        />
      )}
    </div>
  );
}

function PoolDetail({
  pool, models, availableNodes, onClose, onInitialize, onAddNode, onLoad, onUnload, onDelete, busy,
}: {
  pool: Pool;
  models: Record<string, number>;
  availableNodes: { node_id: string; status: string; axl_peer_id: string | null }[];
  onClose: () => void;
  onInitialize: (p: Pool, model: string, price: number) => void;
  onAddNode: (p: Pool, nodeId: string) => void;
  onLoad: () => void;
  onUnload: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const T = useT();
  const isMobile = useBreakpoint();
  const modelKeys = Object.keys(models);
  const [model, setModel] = React.useState(pool.model ?? modelKeys[0] ?? "");
  const [price, setPrice] = React.useState(pool.price_per_token_usdc ?? 0.0001);
  const [pickNode, setPickNode] = React.useState(availableNodes[0]?.node_id ?? "");
  const st = poolState(pool);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 90,
      display: "flex",
      alignItems: isMobile ? "flex-end" : "center",
      justifyContent: "center",
      padding: isMobile ? 0 : 32,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100%" : 720,
          maxWidth: "100%",
          background: T.surface,
          borderRadius: isMobile ? "16px 16px 0 0" : 16,
          overflow: "hidden",
          maxHeight: isMobile ? "88vh" : undefined,
          display: "flex", flexDirection: "column",
        }}>
        <div style={{ padding: isMobile ? "16px 20px" : "20px 28px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 18 : 22, fontWeight: 600, color: T.text1 }}>{pool.name}</div>
            <Badge kind={st.kind} label={st.label} style={{ marginTop: 6 }}/>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: T.text3, fontSize: 22, cursor: "pointer", flexShrink: 0 }}>×</button>
        </div>
        <div style={{ padding: isMobile ? 16 : 24, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <RowKV k="Owner"   v={pool.owner_username}/>
          <RowKV k="Nodes"   v={pool.node_ids.join(", ") || "—"}/>
          <RowKV k="Model"   v={pool.model ?? "—"}/>
          <RowKV k="Price"   v={pool.price_per_token_usdc != null ? `${pool.price_per_token_usdc.toFixed(6)} USDC/tok` : "—"}/>
          <RowKV k="Loaded"  v={pool.loaded ? "yes" : "no"}/>

          {pool.assignments && pool.assignments.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Assignments</div>
              {pool.assignments.map((a) => (
                <div key={a.node_id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontFamily: FONT_MONO, fontSize: 13, gap: 8 }}>
                  <span style={{ color: T.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.node_id}</span>
                  <span style={{ color: T.text2, flexShrink: 0 }}>{a.role} · L{a.layers[0]}–{a.layers[1]}</span>
                </div>
              ))}
            </div>
          )}

          {pool.node_ids.length < 2 && availableNodes.length > 0 && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Add a node ({pool.node_ids.length}/2)
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={pickNode} onChange={(e) => setPickNode(e.target.value)}
                  style={{ flex: 1, minWidth: 160, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, fontFamily: FONT_BODY, fontSize: 14 }}>
                  {availableNodes.map((n) => <option key={n.node_id} value={n.node_id}>{n.node_id} · {n.status}</option>)}
                </select>
                <Button kind="secondary" disabled={!pickNode || busy} onClick={() => onAddNode(pool, pickNode)}>Add</Button>
              </div>
            </div>
          )}

          {pool.node_ids.length === 2 && !pool.initialized && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Initialize
              </div>
              <div style={{ display: "flex", gap: 8, flexDirection: isMobile ? "column" : "row" }}>
                <select value={model} onChange={(e) => setModel(e.target.value)}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, fontFamily: FONT_BODY, fontSize: 14 }}>
                  {modelKeys.map((k) => <option key={k} value={k}>{k} ({models[k]} layers)</option>)}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" step="0.0001" value={price} onChange={(e) => setPrice(parseFloat(e.target.value))}
                    style={{ width: isMobile ? "100%" : 110, flex: isMobile ? 1 : undefined, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, fontFamily: FONT_MONO, fontSize: 13 }}/>
                  <Button kind="primary" disabled={busy} onClick={() => onInitialize(pool, model, price)}>Initialize</Button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {pool.loaded && <Button kind="secondary" onClick={onUnload} disabled={busy}>Unload</Button>}
            {!pool.loaded && pool.initialized && <Button kind="primary" onClick={onLoad} disabled={busy}>Load</Button>}
            <Button kind="destructive" onClick={onDelete} disabled={busy}>Delete</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
