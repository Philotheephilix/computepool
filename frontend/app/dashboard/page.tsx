"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { Badge, Button, Card } from "@/components/cp/primitives";
import { Stat, EventRow, Sparkline, NodeRow } from "@/components/cp/dashboard-bits";
import { NetworkGraph } from "@/components/cp/network-graph";
import { useApiState } from "@/lib/use-api-state";
import { listJobs, totalsByWindow, ago } from "@/lib/job-history";
import { useBreakpoint } from "@/lib/use-breakpoint";

export default function DashOverview() {
  const T = useT();
  const isMobile = useBreakpoint();
  const router = useRouter();
  const { data, authed, loading, error } = useApiState({ pollMs: 5_000 });
  const [jobs, setJobs] = React.useState(() => (typeof window === "undefined" ? [] : listJobs()));

  React.useEffect(() => {
    const id = setInterval(() => setJobs(listJobs()), 4_000);
    return () => clearInterval(id);
  }, []);

  const pools = data?.pools ?? [];
  const nodes = data?.nodes ?? [];
  const models = data?.models ?? {};
  const loadedPools = pools.filter((p) => p.loaded);
  const initializedPools = pools.filter((p) => p.initialized);
  const healthy = nodes.filter((n) => n.status === "loaded" || n.status === "configured" || n.status === "registered").length;
  const totals = totalsByWindow(jobs);

  const events = React.useMemo(() => {
    const evs: { kind: "primary" | "purple" | "red" | "amber"; label: string; meta: string; t: string }[] = [];
    for (const j of jobs.slice(0, 4)) {
      evs.push({
        kind: j.status === "complete" ? "primary" : "red",
        label: j.status === "complete" ? "Inference complete" : "Inference failed",
        meta: `${j.pool} · ${j.tokens ?? 0} tok · ${(j.cost_usdc ?? 0).toFixed(4)} USDC`,
        t: ago(j.ts),
      });
    }
    for (const p of pools.slice(0, 3)) {
      evs.push({
        kind: p.loaded ? "primary" : p.initialized ? "purple" : "amber",
        label: p.loaded ? "Pool loaded" : p.initialized ? "Pool initialized" : "Pool created",
        meta: `${p.name} · ${p.model ?? "no model"}`,
        t: p.updated_at ? new Date(p.updated_at).toLocaleString() : "—",
      });
    }
    return evs.slice(0, 8);
  }, [jobs, pools]);

  if (!authed) {
    return (
      <Card padding={isMobile ? 28 : 48} style={{ maxWidth: 560, margin: isMobile ? "40px auto" : "120px auto", textAlign: "center" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: T.text1 }}>
          Connect to view your network
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2, margin: "12px 0 24px" }}>
          You need an orchestrator API key to see live pools, nodes, and jobs.
        </p>
        <Button kind="primary" onClick={() => router.push("/connect")}>Sign in →</Button>
      </Card>
    );
  }

  return (
    <div>
      <header style={{
        marginBottom: 24,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between",
        alignItems: isMobile ? "flex-start" : "flex-end",
        gap: isMobile ? 14 : 0,
      }}>
        <div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: isMobile ? 24 : 32, color: T.text1, letterSpacing: "-0.02em", margin: 0 }}>
            Network overview
          </h1>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2, marginTop: 4 }}>
            {data?.user.username ?? ""} · {nodes.length} nodes · {pools.length} pools
            {loading && <span style={{ marginLeft: 8, color: T.text3 }}>· refreshing…</span>}
            {error && <span style={{ marginLeft: 8, color: T.red }}>· {error}</span>}
          </div>
        </div>
        <Button kind="primary" onClick={() => router.push("/infer")}>+ New inference</Button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.32fr 1fr", gap: 20 }}>
        {/* NetworkGraph: hidden on mobile (760px canvas won't fit) */}
        {!isMobile && (
          <Card padding={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 500, color: T.text2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Network</span>
              <Badge kind="primary" label={`${loadedPools.length} pool${loadedPools.length !== 1 ? "s" : ""} loaded`}/>
            </div>
            <NetworkGraph width={760} height={520} nodeCount={Math.max(nodes.length || 7, 3)} breachId={null} breachAt={null}/>
          </Card>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Stat label="Active pools"   value={String(loadedPools.length)}/>
            <Stat label="Initialized"    value={String(initializedPools.length)}/>
            <Stat label="Healthy nodes"  value={`${healthy} / ${nodes.length || 0}`}/>
            <Stat label="Models known"   value={String(Object.keys(models).length)}/>
          </div>

          <Card padding={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500, color: T.text2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Live pools</span>
              <Link href="/dashboard/pools" style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.primary, textDecoration: "none" }}>
                Manage →
              </Link>
            </div>
            {loadedPools.length === 0 ? (
              <div style={{ padding: 20, fontFamily: FONT_BODY, fontSize: 13, color: T.text3 }}>
                No loaded pools. Create one in Pools → Initialize → Load.
              </div>
            ) : loadedPools.map((p) => {
              const entry = (p.assignments ?? []).find((a) => a.role === "entry");
              const exit  = (p.assignments ?? []).find((a) => a.role === "exit");
              return (
                <div key={p.name} style={{ padding: "16px 22px", borderTop: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, color: T.text1 }}>{p.model ?? "—"}</span>
                      <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text3, marginLeft: 10 }}>· {p.name}</span>
                    </div>
                    <Badge kind="primary" label="loaded"/>
                  </div>
                  <div style={{ marginTop: 10, fontFamily: FONT_MONO, fontSize: 12, color: T.text3 }}>
                    price {(p.price_per_token_usdc ?? 0).toFixed(4)} USDC/tok · {p.node_ids.length} node{p.node_ids.length !== 1 ? "s" : ""}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {entry && <NodeRow id={entry.node_id} hex={`L${entry.layers[0]}–${entry.layers[1]}`} rate="entry" frozen={false}/>}
                    {exit  && <NodeRow id={exit.node_id}  hex={`L${exit.layers[0]}–${exit.layers[1]}`}   rate="exit"  frozen={false}/>}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.32fr 1fr", gap: 20, marginTop: 20 }}>
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500, color: T.text2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Spend, last 24h</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2 }}>{totals.today.toFixed(4)} USDC today</span>
          </div>
          <div style={{ padding: 24 }}>
            <Sparkline/>
          </div>
        </Card>

        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500, color: T.text2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Event feed</span>
          </div>
          <div style={{ maxHeight: 280, overflow: "auto" }}>
            {events.length === 0 ? (
              <div style={{ padding: 20, fontFamily: FONT_BODY, fontSize: 13, color: T.text3 }}>
                No events yet. Run an inference or initialize a pool to see activity here.
              </div>
            ) : events.map((e, i) => <EventRow key={i} {...e}/>)}
          </div>
        </Card>
      </div>
    </div>
  );
}
