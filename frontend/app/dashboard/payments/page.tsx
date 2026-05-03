"use client";

import * as React from "react";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { Card } from "@/components/cp/primitives";
import { Stat } from "@/components/cp/dashboard-bits";
import { listJobs, totalsByWindow, ago, type JobRecord } from "@/lib/job-history";
import { useBreakpoint } from "@/lib/use-breakpoint";

const EXPLORER = "https://chainscan-galileo.0g.ai/tx/";

export default function DashPayments() {
  const T = useT();
  const isMobile = useBreakpoint();
  const [jobs, setJobs] = React.useState<JobRecord[]>([]);

  React.useEffect(() => {
    setJobs(listJobs());
    const id = setInterval(() => setJobs(listJobs()), 4_000);
    return () => clearInterval(id);
  }, []);

  const totals = totalsByWindow(jobs);
  const settled = jobs.filter((j) => j.settle_tx);

  const buckets = React.useMemo(() => {
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

  return (
    <div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: isMobile ? 24 : 32, color: T.text1, letterSpacing: "-0.02em", margin: "0 0 24px" }}>
        Payments
      </h1>

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
        <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500, color: T.text2, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Settlements
          </span>
        </div>
        {settled.length === 0 ? (
          <div style={{ padding: 24, fontFamily: FONT_BODY, fontSize: 13, color: T.text3 }}>
            No settled jobs in local history yet.
          </div>
        ) : settled.map((j) => (
          isMobile ? (
            <div key={j.request_id} style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text1, fontWeight: 500 }}>{j.model}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3 }}>{ago(j.ts)}</span>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2, marginBottom: 4 }}>
                {j.pool} · {j.tokens ?? "—"} tok · {(j.cost_usdc ?? 0).toFixed(6)} USDC
              </div>
              <a href={EXPLORER + j.settle_tx} target="_blank" rel="noreferrer"
                style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.primary, textDecoration: "none" }}>
                {j.settle_tx!.slice(0, 10)}…{j.settle_tx!.slice(-8)} ↗
              </a>
            </div>
          ) : (
            <div key={j.request_id}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1.4fr 0.8fr", padding: "14px 22px", borderBottom: `1px solid ${T.border}`, alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text1 }}>{j.model}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2 }}>{j.pool}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2 }}>{j.tokens ?? "—"} tok</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text1 }}>
                {(j.cost_usdc ?? 0).toFixed(6)} USDC
              </span>
              <a href={EXPLORER + j.settle_tx} target="_blank" rel="noreferrer"
                style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.primary, textDecoration: "none" }}>
                {j.settle_tx!.slice(0, 10)}…{j.settle_tx!.slice(-8)} ↗
              </a>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3, textAlign: "right" }}>{ago(j.ts)}</span>
            </div>
          )
        ))}
      </Card>
    </div>
  );
}
