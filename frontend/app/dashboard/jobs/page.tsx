"use client";

import * as React from "react";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { Badge, Button, Card } from "@/components/cp/primitives";
import { listJobs, ago, clearJobs, type JobRecord } from "@/lib/job-history";
import { useBreakpoint } from "@/lib/use-breakpoint";

const COLS = "1.4fr 1.2fr 1fr 0.7fr 0.7fr 0.7fr 0.7fr 0.8fr";
const EXPLORER = "https://chainscan-galileo.0g.ai/tx/";

export default function DashJobs() {
  const T = useT();
  const isMobile = useBreakpoint();
  const [jobs, setJobs] = React.useState<JobRecord[]>([]);
  const [open, setOpen] = React.useState<JobRecord | null>(null);

  React.useEffect(() => {
    setJobs(listJobs());
    const id = setInterval(() => setJobs(listJobs()), 4_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: isMobile ? 24 : 32, color: T.text1, letterSpacing: "-0.02em", margin: 0 }}>
          Jobs
        </h1>
        {jobs.length > 0 && (
          <Button kind="ghost" onClick={() => { if (confirm("Clear local job history?")) { clearJobs(); setJobs([]); } }}>
            Clear history
          </Button>
        )}
      </div>

      <div style={{ marginBottom: 12, fontFamily: FONT_BODY, fontSize: 12, color: T.text3 }}>
        Stored locally per browser (no server-side jobs DB yet). Each row is one
        <code style={{ margin: "0 4px" }}>/pools/{"{name}"}/infer/stream</code>
        run from this device.
      </div>

      <Card padding={0} style={{ overflow: "hidden" }}>
        {/* Desktop: column header */}
        {!isMobile && (
          <div style={{
            display: "grid", gridTemplateColumns: COLS, padding: "14px 22px",
            borderBottom: `1px solid ${T.border}`,
            fontFamily: FONT_BODY, fontSize: 12, color: T.text3, fontWeight: 500,
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            <span>Job</span><span>Model</span><span>Pool</span><span>Duration</span>
            <span>Cost</span><span>Tokens</span><span>Status</span><span>Time</span>
          </div>
        )}

        {jobs.length === 0 ? (
          <div style={{ padding: 28, fontFamily: FONT_BODY, fontSize: 13, color: T.text3, textAlign: "center" }}>
            No jobs yet — run an inference at <a href="/infer" style={{ color: T.primary }}>/infer</a>.
          </div>
        ) : jobs.map((j) => (
          isMobile ? (
            <div key={j.request_id} onClick={() => setOpen(j)}
              style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text1, fontWeight: 500 }}>{j.model}</span>
                <Badge kind={j.status === "complete" ? "primary" : "red"} label={j.status}/>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2, marginBottom: 4 }}>
                {j.pool} · {j.tokens ?? "—"} tok
                {j.cost_usdc != null ? ` · ${j.cost_usdc.toFixed(4)} USDC` : ""}
                {j.duration_s != null ? ` · ${j.duration_s.toFixed(1)}s` : ""}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 11, color: T.text3 }}>
                <span>{j.request_id.slice(0, 8)}…</span>
                <span>{ago(j.ts)}</span>
              </div>
            </div>
          ) : (
            <div key={j.request_id} onClick={() => setOpen(j)}
              style={{
                display: "grid", gridTemplateColumns: COLS, padding: "14px 22px",
                borderBottom: `1px solid ${T.border}`, alignItems: "center", cursor: "pointer",
              }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text1 }}>
                {j.request_id.slice(0, 8)}…{j.request_id.slice(-6)}
              </span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text1 }}>{j.model}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2 }}>{j.pool}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2 }}>
                {j.duration_s != null ? `${j.duration_s.toFixed(1)}s` : "—"}
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text1 }}>
                {j.cost_usdc != null ? j.cost_usdc.toFixed(4) : "—"}
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2 }}>{j.tokens ?? "—"}</span>
              <Badge kind={j.status === "complete" ? "primary" : "red"} label={j.status}/>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3 }}>{ago(j.ts)}</span>
            </div>
          )
        ))}
      </Card>

      {open && <JobDetail j={open} onClose={() => setOpen(null)}/>}
    </div>
  );
}

function JobDetail({ j, onClose }: { j: JobRecord; onClose: () => void }) {
  const T = useT();
  const isMobile = useBreakpoint();
  return (
    <div onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 90,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 32,
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100%" : 760,
          maxWidth: "100%",
          background: T.surface,
          borderRadius: isMobile ? "16px 16px 0 0" : 16,
          overflow: "hidden",
          maxHeight: isMobile ? "88vh" : "90vh",
          display: "flex", flexDirection: "column",
        }}>
        <div style={{ padding: isMobile ? "16px 20px" : "20px 28px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ minWidth: 0, marginRight: 12 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 16 : 18, fontWeight: 600, color: T.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {j.model} · {j.pool}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {j.request_id}
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: T.text3, fontSize: 22, cursor: "pointer", flexShrink: 0 }}>×</button>
        </div>
        <div style={{ padding: isMobile ? 16 : 24, overflow: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          <Section title="Prompt"><Pre>{j.prompt}</Pre></Section>
          {j.output && <Section title="Output"><Pre>{j.output}</Pre></Section>}
          {j.error && <Section title="Error"><Pre>{j.error}</Pre></Section>}
          <Section title="Metadata">
            <Row k="status"   v={j.status}/>
            <Row k="duration" v={j.duration_s != null ? `${j.duration_s.toFixed(2)} s` : "—"}/>
            <Row k="tokens"   v={String(j.tokens ?? "—")}/>
            <Row k="cost"     v={j.cost_usdc != null ? `${j.cost_usdc.toFixed(6)} USDC` : "—"}/>
            <Row k="payer"    v={j.payer ?? "—"}/>
            <Row k="settle_tx" v={j.settle_tx
              ? `${j.settle_tx.slice(0, 10)}…${j.settle_tx.slice(-8)}`
              : "—"}
              link={j.settle_tx ? EXPLORER + j.settle_tx : undefined}/>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const T = useT();
  return (
    <div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}
function Pre({ children }: { children: React.ReactNode }) {
  const T = useT();
  return (
    <pre style={{
      margin: 0, padding: 14, borderRadius: 8, background: T.surfaceWarm,
      fontFamily: FONT_MONO, fontSize: 13, color: T.text1, lineHeight: 1.55,
      whiteSpace: "pre-wrap", wordBreak: "break-word",
    }}>{children}</pre>
  );
}
function Row({ k, v, link }: { k: string; v: string; link?: string }) {
  const T = useT();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", gap: 8 }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text2, flexShrink: 0 }}>{k}</span>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.text1, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {v} <span style={{ color: T.text3 }}>↗</span>
        </a>
      ) : (
        <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
      )}
    </div>
  );
}
