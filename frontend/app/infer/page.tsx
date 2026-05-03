"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { Badge, Button, Card } from "@/components/cp/primitives";
import { useInferState } from "@/lib/use-infer-state";
import { useApiState } from "@/lib/use-api-state";
import type { Pool } from "@/lib/api";

const DEMO_MODELS = [
  { id: "qwen",    name: "Qwen3-4B-Instruct", model: "Qwen/Qwen2.5-3B-Instruct", params: "4B parameters", pools: 2, latency: "11 tok/s", price: "0.02" },
  { id: "llama",   name: "Llama-3.1-8B",      model: "meta-llama/Llama-3.2-3B",  params: "8B parameters", pools: 1, latency: "8 tok/s",  price: "0.04" },
  { id: "mistral", name: "Mistral-7B",        model: "mistral/mistral-7b",       params: "7B parameters", pools: 1, latency: "9 tok/s",  price: "0.03" },
];

function paramsLabel(model: string): string {
  const m = /-(\d+(?:\.\d+)?)B/i.exec(model);
  return m ? `${m[1]}B parameters` : model.split("/").pop() ?? model;
}

function shortName(model: string): string {
  const tail = model.split("/").pop() ?? model;
  return tail.replace(/-(?:Instruct|Chat).*$/i, "").replace(/(\d)\.(\d+)/, "$1.$2");
}

export default function InferStep1() {
  const T = useT();
  const router = useRouter();
  const { state, setState } = useInferState();
  const { data, authed, loading } = useApiState({ pollMs: 15_000 });

  const livePools: Pool[] = (data?.pools ?? []).filter((p) => p.loaded && p.initialized);
  const hasLive = livePools.length > 0;

  return (
    <div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 40, color: T.text1, letterSpacing: "-0.02em", margin: "0 0 8px", textAlign: "center" }}>
        Choose a model
      </h1>
      <p style={{ fontFamily: FONT_BODY, fontSize: 16, color: T.text2, textAlign: "center", margin: "0 0 16px" }}>
        Each pool is a coalition of operators running the model in shards.
      </p>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        {!authed && (
          <Badge kind="amber" label="Sign in to /connect to use live pools — demo mode active"/>
        )}
        {authed && !loading && !hasLive && (
          <Badge kind="amber" label="No loaded pools yet — demo mode active. Initialize one in /dashboard/pools."/>
        )}
        {authed && hasLive && (
          <Badge kind="primary" label={`${livePools.length} live pool${livePools.length > 1 ? "s" : ""} ready`}/>
        )}
      </div>

      {hasLive && (
        <>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Live pools
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(livePools.length, 3)}, 1fr)`, gap: 20, marginBottom: 32 }}>
            {livePools.map((p) => {
              const sel = state.mode === "live" && state.poolName === p.name;
              return (
                <div key={p.name}
                  onClick={() => setState({
                    ...state,
                    mode: "live",
                    poolName: p.name,
                    model: p.model ?? "",
                    modelName: shortName(p.model ?? p.name),
                    pricePerTokenUsdc: p.price_per_token_usdc ?? 0,
                    assignments: p.assignments ?? null,
                  })}
                  style={cardStyle(T, sel)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: T.text1 }}>
                        {shortName(p.model ?? p.name)}
                      </div>
                      <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2, marginTop: 4 }}>
                        {paramsLabel(p.model ?? "")} · pool {p.name}
                      </div>
                    </div>
                    <Badge kind="primary" label="loaded"/>
                  </div>
                  <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                    <RowMini k="Nodes" v={String(p.node_ids.length)}/>
                    <RowMini k="Price" v={`${(p.price_per_token_usdc ?? 0).toFixed(4)} USDC/tok`}/>
                    <RowMini k="Status" v={p.loaded ? "ready" : "initialized"}/>
                  </div>
                  <div style={{ marginTop: 20, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 500, color: sel ? T.primary : T.text2 }}>
                    {sel ? "✓ Selected" : "Select →"}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        Catalog (demo)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {DEMO_MODELS.map((m) => {
          const sel = state.mode === "demo" && state.poolName === `${m.id}-pool-1`;
          return (
            <div key={m.id}
              onClick={() => setState({
                ...state,
                mode: "demo",
                poolName: `${m.id}-pool-1`,
                model: m.model,
                modelName: m.name,
                pricePerTokenUsdc: parseFloat(m.price) / 100,
              })}
              style={cardStyle(T, sel)}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: T.text1 }}>{m.name}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2, marginTop: 4 }}>{m.params}</div>
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                <RowMini k="Pools"   v={String(m.pools)}/>
                <RowMini k="Latency" v={m.latency}/>
                <RowMini k="Price"   v={`${m.price} USDCx`}/>
              </div>
              <div style={{ marginTop: 20, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 500, color: sel ? T.primary : T.text2 }}>
                {sel ? "✓ Selected" : "Select →"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
        <Button kind="primary" disabled={!state.model} onClick={() => router.push("/infer/setup")} style={{ padding: "12px 32px" }}>
          Continue →
        </Button>
      </div>
    </div>
  );
}

function cardStyle(T: ReturnType<typeof useT>, sel: boolean): React.CSSProperties {
  return {
    background: sel ? T.primaryLight : T.surface,
    border: sel ? `2px solid ${T.primary}` : `1px solid ${T.border}`,
    borderRadius: 16, padding: 28, cursor: "pointer",
    transition: "all 200ms ease",
    transform: sel ? "translateY(-2px)" : "none",
    boxShadow: sel ? `0 8px 24px ${T.primary}22` : "0 1px 3px rgba(0,0,0,0.04)",
  };
}

function RowMini({ k, v }: { k: string; v: string }) {
  const T = useT();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text2, whiteSpace: "nowrap" }}>{k}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.text1, fontWeight: 500, whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}
