"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { Badge, Button, Card, RowKV } from "@/components/cp/primitives";
import { useInferState } from "@/lib/use-infer-state";
import { useBreakpoint } from "@/lib/use-breakpoint";

export default function InferStep2() {
  const T = useT();
  const isMobile = useBreakpoint();
  const router = useRouter();
  const { state, setState } = useInferState();
  const [prompt, setPrompt] = React.useState(state.prompt);
  const [budget, setBudget] = React.useState(state.budget);
  const [maxTokens, setMaxTokens] = React.useState(state.maxTokens);

  const live = state.mode === "live";
  const price = state.pricePerTokenUsdc || 0.0001;
  const estCost = (price * maxTokens).toFixed(4);

  const proceed = () => {
    setState({ ...state, prompt, budget, maxTokens });
    router.push("/infer/review");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 24 }}>
      <Card padding={isMobile ? 20 : 32}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text2 }}>Your prompt</span>
          <Badge kind={live ? "primary" : "amber"} label={live ? "live mode" : "demo mode"}/>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Explain how attention works in transformers, simply."
          style={{
            width: "100%", height: isMobile ? 200 : 280, padding: 16, borderRadius: 10, resize: "none",
            border: `1px solid ${T.border}`, background: T.surface, color: T.text1,
            fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 18, lineHeight: 1.5, outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = T.primary)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />
        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 12, color: T.text3 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{state.modelName} · {state.poolName}</span>
          <span style={{ flexShrink: 0 }}>{prompt.length} / 2000</span>
        </div>
      </Card>

      <Card padding={isMobile ? 20 : 32}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text2 }}>Budget</div>
        <div style={{ marginTop: 14, fontFamily: FONT_DISPLAY, fontSize: isMobile ? 44 : 64, fontWeight: 600, color: T.text1, letterSpacing: "-0.03em", lineHeight: 1 }}>
          {budget.toFixed(2)}
          <span style={{ fontSize: isMobile ? 16 : 22, color: T.text2, marginLeft: 8, fontWeight: 500 }}>USDCx</span>
        </div>
        <input type="range" min="0.10" max="5.00" step="0.01" value={budget}
          onChange={(e) => setBudget(parseFloat(e.target.value))}
          style={{ width: "100%", marginTop: 20, accentColor: T.primary }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 11, color: T.text3 }}>
          <span>0.10</span><span>5.00</span>
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text2 }}>Max tokens</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.text1, fontWeight: 500 }}>{maxTokens}</span>
          </div>
          <input type="range" min="5" max={live ? "60" : "300"} step="1" value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
            style={{ width: "100%", accentColor: T.primary }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 11, color: T.text3 }}>
            <span>5</span><span>{live ? "60 (live cap)" : "300"}</span>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
          <RowKV k="Est. cost"     v={`${estCost} USDC`}/>
          <RowKV k="Price per tok" v={`${price.toFixed(6)} USDC`}/>
          <RowKV k="Est. duration" v={`~${Math.round(maxTokens * (live ? 8 : 0.05))} seconds`}/>
        </div>
        <div style={{ marginTop: 16, fontFamily: FONT_BODY, fontSize: 13, color: T.text2, lineHeight: 1.5 }}>
          {live
            ? "You'll authorize an EIP-3009 transferWithAuthorization on Step 3. The relayer settles after the stream completes; unused authorization is wasted (single-shot)."
            : "Demo mode replays a canned animation — no on-chain payment is signed."}
        </div>
        <Button kind="primary" full disabled={!prompt} onClick={proceed} style={{ marginTop: 20, padding: "14px 24px" }}>
          Continue →
        </Button>
      </Card>
    </div>
  );
}
