"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { Button, Card, RowKV } from "@/components/cp/primitives";
import { useInferState } from "@/lib/use-infer-state";

const FALLBACK_TEXT = `Attention is how a transformer decides what to focus on.

For each token in the input, the model computes three vectors: a query, a key, and a value.`;

const EXPLORER = "https://chainscan-galileo.0g.ai/tx/";

function txLabel(h?: string): string {
  if (!h) return "—";
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

export default function InferStep5() {
  const T = useT();
  const router = useRouter();
  const { state } = useInferState();
  const live = state.mode === "live";
  const breached = !!state.breached;
  const output = state.output ?? FALLBACK_TEXT;
  const tokens = state.tokens ?? (live ? 0 : 312);
  const durSec = (state.durationMs ?? (live ? 0 : 28400)) / 1000;
  const cost = state.costUsdc ?? (live ? 0 : 0.123);
  const refund = Math.max((live ? state.maxTokens * state.pricePerTokenUsdc : state.budget) - cost, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 18, background: T.primary,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 18, fontWeight: 600,
        }}>✓</div>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: T.text1, letterSpacing: "-0.02em" }}>
            Inference complete
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2, marginTop: 2 }}>
            {durSec.toFixed(1)}s · {tokens} tokens · {live ? "settled on 0G Galileo" : "demo run"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <Card padding={32}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500, color: T.text2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Output</span>
            <Button kind="secondary" onClick={() => navigator.clipboard?.writeText(output)}>Copy</Button>
          </div>
          <div style={{ marginTop: 20, fontFamily: FONT_MONO, fontSize: 15, color: T.text1, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {output}
          </div>
        </Card>

        <Card padding={32}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: T.text1, margin: "0 0 20px" }}>Job receipt</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <RowKV k="Pool"     v={state.poolName}/>
            <RowKV k="Model"    v={state.modelName}/>
            <RowKV k="Duration" v={`${durSec.toFixed(2)} seconds`}/>
            <RowKV k="Tokens"   v={`${tokens} output`}/>
            {state.payer && <RowKV k="Payer" v={`${state.payer.slice(0, 8)}…${state.payer.slice(-6)}`}/>}
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.text2, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Payment breakdown
            </div>
            {(() => {
              // Use real pool assignments if present; otherwise fall back to a generic 50/50 split.
              const assignments = state.assignments ?? null;
              const fallback = [
                { node_id: "entry", role: "entry" as const, layers: [0, 0] as [number, number] },
                { node_id: "exit",  role: "exit"  as const, layers: [0, 0] as [number, number] },
              ];
              const rows = assignments && assignments.length === 2 ? assignments : fallback;
              const totalLayers = rows.reduce((a, r) => a + Math.max(r.layers[1] - r.layers[0], 1), 0);
              const sortedRows = [...rows].sort(
                (a, b) => (a.role === "entry" ? -1 : 1) - (b.role === "entry" ? -1 : 1),
              );
              const exitNodeId = sortedRows.find(r => r.role === "exit")?.node_id;
              return sortedRows.map((r) => {
                const span = Math.max(r.layers[1] - r.layers[0], 1);
                const share = cost * (span / totalLayers);
                const slashed = breached && r.node_id === exitNodeId;
                const label = `${r.node_id} (L${r.layers[0]}–${r.layers[1] - 1})`;
                return (
                  <div key={r.node_id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2 }}>{label}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 14,
                      color: slashed ? T.red : (share > 0 ? T.text1 : T.text3),
                      fontVariantNumeric: "tabular-nums" }}>
                      {slashed ? (
                        <>
                          <span style={{ marginRight: 6 }}>slashed</span>
                          <span style={{ textDecoration: "line-through", color: T.text3 }}>
                            {share.toFixed(6)}
                          </span>
                        </>
                      ) : `${share.toFixed(6)} USDC`}
                    </span>
                  </div>
                );
              });
            })()}
            <div style={{ height: 1, background: T.border, margin: "10px 0" }}/>
            <RowKV k="Subtotal" v={`${(breached ? cost / 2 : cost).toFixed(6)} USDC`}/>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2 }}>Refunded</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: T.primary, fontWeight: 500,
                fontVariantNumeric: "tabular-nums" }}>
                {refund.toFixed(6)} USDC
              </span>
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.text2, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>On-chain audit trail</div>
            {([
              ["Settlement", state.settleTx, "primary" as const],
              ...(breached ? [["Slash", undefined, "red" as const] as const] : []),
            ] as const).map(([label, hash, kind]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: kind === "red" ? T.red : T.primary,
                  }}/>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2 }}>{label}</span>
                </span>
                {hash ? (
                  <a href={`${EXPLORER}${hash}`} target="_blank" rel="noreferrer"
                    style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.text1, textDecoration: "none" }}>
                    {txLabel(hash)} <span style={{ color: T.text3 }}>↗</span>
                  </a>
                ) : (
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.text3 }}>—</span>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, fontFamily: FONT_BODY, fontSize: 11, color: T.text3, lineHeight: 1.5 }}>
            Per-node payouts route through the pool&apos;s Superfluid GDA on the orchestrator at
            request close. Membership units are held by the operators&apos; signing addresses.
          </div>
          <Button kind="primary" full style={{ marginTop: 20 }} onClick={() => router.push("/infer")}>
            Run another →
          </Button>
        </Card>
      </div>
    </div>
  );
}
