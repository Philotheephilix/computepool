"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { Badge, Button, Card, RowKV } from "@/components/cp/primitives";
import { useInferState } from "@/lib/use-infer-state";
import { fetchPaymentRequirements, verifyPayment } from "@/lib/infer-stream";
import { signX402, signX402WithWallet } from "@/lib/sign-payment";
import { loadAuth, loadDemoPayerKey, loadChainId } from "@/lib/auth-store";
import { useWallet } from "@/lib/use-wallet";

export default function InferStep3() {
  const T = useT();
  const router = useRouter();
  const { state, setState } = useInferState();
  const [ph, setPh] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [phaseLabel, setPhaseLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    const id = setInterval(() => setPh((p) => p + 1), 100);
    return () => clearInterval(id);
  }, []);

  const live = state.mode === "live";
  // Defer reading browser-only storage (localStorage, wallet) until after mount.
  // Reading these during render causes the server-rendered HTML (always null)
  // to disagree with the client tree (real values), producing React #418
  // "hydration failed" errors.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  const auth = mounted ? loadAuth() : null;
  const demoKey = mounted ? loadDemoPayerKey() : null;
  const { state: wallet, connect: connectWallet, switchChain, busy: walletBusy } = useWallet();
  const useWalletSigning = mounted && !!wallet.address;
  const useDemoKeySigning = mounted && !useWalletSigning && !!demoKey;
  const liveReady = live && !!auth && (useWalletSigning || useDemoKeySigning);

  const liveBlocker = !auth
    ? "Sign in at /connect first."
    : !useWalletSigning && !useDemoKeySigning
    ? "Connect a wallet on /connect (or add a demo payer key)."
    : useWalletSigning && !wallet.rightChain
    ? `Wallet is on chain ${wallet.chainId ?? "?"}; switch to ${wallet.expectedChainId} (0G Galileo).`
    : null;

  const confirm = async () => {
    setErr(null);
    setPhaseLabel(null);
    if (!live) {
      router.push("/infer/active");
      return;
    }
    if (!auth) { setErr("Sign in at /connect first."); return; }
    setBusy(true);
    try {
      if (useWalletSigning && !wallet.rightChain) {
        setPhaseLabel("Switching wallet to 0G Galileo…");
        await switchChain();
      }
      setPhaseLabel("Fetching x402 payment requirements…");
      const requirements = await fetchPaymentRequirements({
        poolName: state.poolName,
        prompt: state.prompt,
        maxTokens: state.maxTokens,
        apiKey: auth.apiKey,
      });
      const chainId = loadChainId();
      setPhaseLabel(useWalletSigning ? "Waiting for wallet signature…" : "Signing locally…");
      const { header, payer } = useWalletSigning
        ? await signX402WithWallet({ account: wallet.address!, requirements, chainId })
        : await signX402({ privateKey: demoKey!, requirements, chainId });

      // PRE-VERIFY before navigating: hits the orchestrator's verify-only
      // route which calls the facilitator with the same X-PAYMENT we'd send
      // to /infer/stream. If the facilitator rejects (insufficient balance,
      // bad sig, expired auth, replayed nonce), we keep the user here and
      // surface the real reason instead of failing one screen later.
      setPhaseLabel("Confirming payment with facilitator…");
      const v = await verifyPayment({
        poolName: state.poolName,
        prompt: state.prompt,
        maxTokens: state.maxTokens,
        apiKey: auth.apiKey,
        xPayment: header,
      });
      if (!v.isValid) {
        setErr(`Facilitator rejected the payment: ${v.invalidReason ?? "unknown"}`);
        return;
      }

      setState({ ...state, xPayment: header, payer: v.payer ?? payer, requirements });
      setPhaseLabel("Verified — starting stream…");
      router.push("/infer/active");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      // leave phaseLabel set if we navigated; cleared only on next click
    }
  };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <Card padding={48}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 28, color: T.text1, letterSpacing: "-0.02em", margin: "0 0 28px" }}>
            Review your request
          </h2>
          <Badge kind={live ? "primary" : "amber"} label={live ? "live" : "demo"}/>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <RowKV k="Model"         v={state.modelName}/>
          <RowKV k="Pool"          v={state.poolName}/>
          <RowKV k="Max tokens"    v={String(state.maxTokens)}/>
          <RowKV k="Est. cost"     v={`${(state.maxTokens * state.pricePerTokenUsdc).toFixed(4)} USDC`}/>
          <RowKV k="Est. duration" v={`~${Math.round(state.maxTokens * (live ? 8 : 0.05))} seconds`}/>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2 }}>Coalition</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: live ? T.primary : T.amber, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: live ? T.primary : T.amber, opacity: 0.5 + 0.5 * Math.sin(ph * 0.3) }}/>
              {live ? "Already on-chain" : "Forming on-chain…"}
            </span>
          </div>
          {state.payer && (
            <RowKV k="Payer" v={`${state.payer.slice(0, 8)}…${state.payer.slice(-6)}`}/>
          )}
        </div>

        <div style={{ marginTop: 28, padding: 20, borderRadius: 10, background: T.surfaceWarm, fontFamily: FONT_BODY, fontSize: 15, color: T.text2, lineHeight: 1.6 }}>
          “{state.prompt}”
        </div>

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text2, marginBottom: 10, fontWeight: 500 }}>
            What happens when you confirm
          </div>
          {(live ? [
            "Orchestrator returns 402 with x402 PaymentRequirements",
            "Browser signs EIP-3009 transferWithAuthorization (USDC)",
            "POST /pools/{name}/infer/stream with the signed X-PAYMENT",
            "Tokens stream over SSE; settlement happens on done",
          ] : [
            "Skip on-chain — show the canned animation",
            "Token stream comes from a static script",
            "No wallet, no payment, no settlement",
            "Useful to demo the flow without real infra",
          ]).map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "4px 0", fontFamily: FONT_BODY, fontSize: 14, color: T.text2 }}>
              <span style={{ color: T.primary, fontWeight: 500 }}>{i + 1}.</span> {s}
            </div>
          ))}
        </div>

        {live && (
          <div style={{
            marginTop: 16, padding: "12px 14px", borderRadius: 8,
            background: T.surfaceWarm, fontFamily: FONT_BODY, fontSize: 13, color: T.text2,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <span>
              Signer: {useWalletSigning
                ? <strong style={{ color: T.text1, fontFamily: FONT_MONO }}>{wallet.address!.slice(0, 8)}…{wallet.address!.slice(-6)} (wallet)</strong>
                : useDemoKeySigning
                  ? <strong style={{ color: T.text1 }}>demo payer key</strong>
                  : <strong style={{ color: T.amber }}>none</strong>}
            </span>
            {!useWalletSigning && wallet.available && (
              <Button kind="secondary" disabled={walletBusy} onClick={connectWallet}>
                {walletBusy ? "Connecting…" : "Use wallet instead →"}
              </Button>
            )}
          </div>
        )}

        {live && liveBlocker && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 8,
            background: T.amberLight, fontFamily: FONT_BODY, fontSize: 13, color: T.amber,
          }}>
            {liveBlocker}
          </div>
        )}
        {phaseLabel && !err && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 8,
            background: T.surfaceWarm,
            fontFamily: FONT_MONO, fontSize: 12, color: T.text2,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 4, background: T.primary,
              animation: "cp-pulse 1.6s ease-in-out infinite",
            }}/>
            {phaseLabel}
          </div>
        )}
        {err && (
          <div style={{
            marginTop: 16, padding: "10px 14px", borderRadius: 8,
            background: T.redLight, fontFamily: FONT_BODY, fontSize: 13, color: T.red,
            wordBreak: "break-word",
          }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
          <Button kind="secondary" onClick={() => router.push("/infer/setup")} style={{ flex: 1 }}>
            Back
          </Button>
          <Button kind="primary" onClick={confirm} disabled={busy || (live && !liveReady)} style={{ flex: 2 }}>
            {busy ? "Signing…" : (live ? "Confirm + Pay →" : "Run demo →")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
