"use client";

import * as React from "react";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { Badge, Button, Card } from "@/components/cp/primitives";
import { Stat } from "@/components/cp/dashboard-bits";
import { listJobs, totalsByWindow, ago, type JobRecord } from "@/lib/job-history";
import { useBreakpoint } from "@/lib/use-breakpoint";
import { listJobs, totalsByWindow, ago, clearJobs, type JobRecord } from "@/lib/job-history";

const EXPLORER = "https://chainscan-galileo.0g.ai/tx/";

function shortTx(tx: string): string {
  if (!tx) return "—";
  if (tx.length <= 20) return tx;
  return `${tx.slice(0, 10)}…${tx.slice(-8)}`;
}

function jobStatus(j: JobRecord): { label: string; kind: "primary" | "amber" | "red" | "purple" | "offline" } {
  if (j.status === "error") return { label: "Errored", kind: "red" };
  if (j.settle_tx) return { label: "Settled", kind: "primary" };
  if ((j.tokens ?? 0) > 0) return { label: "Streamed · unsettled", kind: "amber" };
  return { label: "No tokens", kind: "offline" };
}

export default function DashPayments() {
  const T = useT();
  const isMobile = useBreakpoint();
  const [jobs, setJobs] = React.useState<JobRecord[]>([]);
  const [showAll, setShowAll] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const tick = () => { if (!cancelled) setJobs(listJobs()); };
    void Promise.resolve().then(tick);
    const id = setInterval(tick, 3_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const totals = totalsByWindow(jobs);
  const settled = jobs.filter((j) => j.settle_tx);
  const visible = showAll ? jobs : settled;

  const buckets = React.useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- bucketing needs current time; recomputed when jobs change
    const now = Date.now();
    const bin = 60 * 60 * 1000;
    const arr = Array.from({ length: 24 }, () => 0);
    for (const j of jobs) {
      const age = now - j.ts;
      if (age < 0 || age >= 24 * bin) continue;
      const i = 23 - Math.floor(age / bin);
      arr[i] += j.cost_usdc ?? 0;
    }
    return arr;
  }, [jobs]);

  const max = Math.max(...buckets, 0.0001);
  const W = 720, H = 160;
  const pts = buckets.map((v, i) => [i * (W / Math.max(buckets.length - 1, 1)), H - (v / max) * H * 0.85 - 10]);
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" ");
  const fill = `${d} L ${W} ${H} L 0 ${H} Z`;

  const totalTokens = jobs.reduce((a, j) => a + (j.tokens ?? 0), 0);

  return (
    <div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: isMobile ? 24 : 32, color: T.text1, letterSpacing: "-0.02em", margin: "0 0 24px" }}>
        Payments
      </h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 32, color: T.text1, letterSpacing: "-0.02em", margin: 0 }}>
          Payments
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge kind="primary" label={`${jobs.length} jobs · ${totalTokens.toLocaleString()} tokens`}/>
          {jobs.length > 0 && (
            <Button kind="ghost"
              onClick={() => {
                if (window.confirm("Clear local job history? This wipes the localStorage record only — settled txs remain on chain.")) {
                  clearJobs();
                  setJobs([]);
                }
              }}>
              Clear history
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: isMobile ? 12 : 16, marginBottom: 24 }}>
        <Stat label="Today"     value={`${totals.today.toFixed(4)} USDC`}/>
        <Stat label="7 days"    value={`${totals.week.toFixed(4)} USDC`}/>
        <Stat label="30 days"   value={`${totals.month.toFixed(4)} USDC`}/>
        <Stat label="All time"  value={`${totals.all.toFixed(4)} USDC`}/>
      </div>

      <Card padding={isMobile ? 20 : 32}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500, color: T.text2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
          Hourly spend, last 24h
        </div>
        {jobs.length === 0 ? (
          <div style={{ padding: "40px 0", fontFamily: FONT_BODY, fontSize: 14, color: T.text3, textAlign: "center" }}>
            No payments yet. Run a live inference to see settlement data.
          </div>
        ) : (
          <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ display: "block" }}>
            <defs>
              <linearGradient id="cp-pay-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={T.primary} stopOpacity="0.3"/>
                <stop offset="100%" stopColor={T.primary} stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d={fill} fill="url(#cp-pay-grad)"/>
            <path d={d} stroke={T.primary} strokeWidth="2" fill="none"/>
            {buckets.map((_, i) => (
              <text key={i} x={i * (W / Math.max(buckets.length - 1, 1))} y={H + 16} fontFamily={FONT_MONO} fontSize="9" fill={T.text3} textAnchor="middle">
                {i % 4 === 0 ? `-${24 - i}h` : ""}
              </text>
            ))}
          </svg>
        )}
      </Card>

      <Card padding={0} style={{ overflow: "hidden", marginTop: 20 }}>
        <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500, color: T.text2, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {showAll ? "Recent activity" : "Settlements"}
            <span style={{ marginLeft: 8, color: T.text3 }}>
              ({visible.length})
            </span>
          </span>
          <div style={{ display: "flex", gap: 4, fontFamily: FONT_MONO, fontSize: 11 }}>
            <button
              onClick={() => setShowAll(true)}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: showAll ? T.primaryLight : "transparent",
                color: showAll ? T.primary : T.text2,
              }}>All</button>
            <button
              onClick={() => setShowAll(false)}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: !showAll ? T.primaryLight : "transparent",
                color: !showAll ? T.primary : T.text2,
              }}>Settled only</button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div style={{ padding: 24, fontFamily: FONT_BODY, fontSize: 13, color: T.text3 }}>
            {jobs.length === 0
              ? "No jobs in local history yet. Run an inference to populate this view."
              : "No matching jobs. Try the All filter."}
          </div>
        ) : (
          <div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 0.6fr 0.9fr 1.2fr 1.2fr 0.7fr",
              padding: "10px 22px",
              borderBottom: `1px solid ${T.border}`,
              background: T.surfaceWarm,
              fontFamily: FONT_MONO, fontSize: 10, color: T.text3,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              <span>Model</span>
              <span>Pool</span>
              <span style={{ textAlign: "right" }}>Tokens</span>
              <span style={{ textAlign: "right" }}>Cost</span>
              <span>Status</span>
              <span>Settlement</span>
              <span style={{ textAlign: "right" }}>When</span>
            </div>
            {visible.map((j) => {
              const st = jobStatus(j);
              return (
                <div key={j.request_id}
                  title={j.prompt ? `Prompt: ${j.prompt.slice(0, 200)}${j.prompt.length > 200 ? "…" : ""}` : undefined}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 0.6fr 0.9fr 1.2fr 1.2fr 0.7fr",
                    padding: "14px 22px",
                    borderBottom: `1px solid ${T.border}`,
                    alignItems: "center", gap: 12,
                  }}>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text1 }}>
                    {j.model || "—"}
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2 }}>
                    {j.pool || "—"}
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12,
                    color: (j.tokens ?? 0) > 0 ? T.text1 : T.text3, textAlign: "right",
                    fontVariantNumeric: "tabular-nums" }}>
                    {j.tokens ?? 0}
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12,
                    color: (j.cost_usdc ?? 0) > 0 ? T.text1 : T.text3, textAlign: "right",
                    fontVariantNumeric: "tabular-nums" }}>
                    {(j.cost_usdc ?? 0).toFixed(6)}
                  </span>
                  <Badge kind={st.kind} label={st.label}/>
                  {j.settle_tx ? (
                    <a href={EXPLORER + j.settle_tx} target="_blank" rel="noreferrer"
                      style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.primary, textDecoration: "none" }}>
                      {shortTx(j.settle_tx)} ↗
                    </a>
                  ) : (
                    <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text3 }}>—</span>
                  )}
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3, textAlign: "right" }}>
                    {ago(j.ts)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
