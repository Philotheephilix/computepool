"use client";

import * as React from "react";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { Badge, Button, Card } from "@/components/cp/primitives";
import { useApiState } from "@/lib/use-api-state";
import { nodes as nodesApi, type Node } from "@/lib/api";
import { truncHex } from "@/components/cp/primitives";
import { useBreakpoint } from "@/lib/use-breakpoint";

function statusKind(s: Node["status"]): "primary" | "amber" | "purple" | "offline" {
  if (s === "loaded") return "primary";
  if (s === "configured") return "purple";
  if (s === "registered") return "amber";
  return "offline";
}

export default function DashNodes() {
  const T = useT();
  const isMobile = useBreakpoint();
  const { data, authed, refresh } = useApiState({ pollMs: 5_000 });
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  if (!authed) {
    return <Card padding={32}>Sign in at <a href="/connect" style={{ color: T.primary }}>/connect</a> first.</Card>;
  }
  const nodes = data?.nodes ?? [];

  const remove = async (n: Node) => {
    if (!confirm(`Forget ${n.node_id}? Worker will re-register on its next heartbeat.`)) return;
    setBusy(n.node_id); setErr(null);
    try { await nodesApi.delete(n.node_id); await refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: isMobile ? 24 : 32, color: T.text1, letterSpacing: "-0.02em", margin: 0 }}>
          Nodes
        </h1>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text3 }}>{nodes.length} registered</span>
      </div>

      {err && <Card padding={16} style={{ marginBottom: 16, background: T.redLight }}><span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.red }}>{err}</span></Card>}

      {nodes.length === 0 ? (
        <Card padding={32}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2, textAlign: "center" }}>
            No nodes yet. Bring up a worker container with <code>OWNER_API_KEY</code> set to your account&apos;s key
            and it&apos;ll appear here on its next heartbeat.
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 16 }}>
          {nodes.map((n) => (
            <Card key={n.node_id} padding={20}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, marginRight: 12 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: T.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.node_id}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text3, marginTop: 2 }}>
                    pool: {n.pool_name ?? "—"}
                  </div>
                </div>
                <Badge kind={statusKind(n.status)} label={n.status}/>
              </div>

              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr", gap: 8, fontFamily: FONT_MONO, fontSize: 12 }}>
                <KV k="role"          v={n.role ?? "—"}/>
                <KV k="layers"        v={n.layers ? `L${n.layers[0]}–${n.layers[1]}` : "—"}/>
                <KV k="model"         v={n.model ?? "—"}/>
                <KV k="axl_peer_id"   v={n.axl_peer_id ? truncHex(n.axl_peer_id, 8, 6) : "—"}/>
                <KV k="ip_address"    v={n.ip_address ?? "—"}/>
                <KV k="worker_url"    v={n.worker_url ?? "—"}/>
                <KV k="last_seen"     v={n.last_seen ? new Date(n.last_seen).toLocaleTimeString() : "—"}/>
              </div>
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <Button kind="ghost" disabled={busy === n.node_id} onClick={() => remove(n)}>
                  {busy === n.node_id ? "Removing…" : "Forget"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  const T = useT();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: T.text3, flexShrink: 0 }}>{k}</span>
      <span style={{ color: T.text1, textAlign: "right", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span>
    </div>
  );
}
