"use client";

import * as React from "react";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { TopNav, Footer } from "@/components/cp/top-nav";
import { Badge, Button, Card } from "@/components/cp/primitives";
import { useWallet } from "@/lib/use-wallet";
import { pools as poolsApi, type Pool } from "@/lib/api";
import { getWalletClient, ZERO_G_GALILEO } from "@/lib/wallet";
import { encodeFunctionData, type Hex } from "viem";

const INFT_CONTRACT_ADDR = (process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDR ?? "") as `0x${string}`;

const AUTHORIZE_USAGE_ABI = [{
  type: "function",
  name: "authorizeUsage",
  stateMutability: "nonpayable",
  inputs: [
    { name: "tokenId", type: "uint256" },
    { name: "user", type: "address" },
    { name: "expiresAt", type: "uint256" },
  ],
  outputs: [],
}] as const;

type AuthorizeArgs = { tokenId: bigint; renter: `0x${string}`; expiresAt: bigint };

async function callAuthorizeUsage(args: AuthorizeArgs, from: `0x${string}`): Promise<Hex> {
  if (!INFT_CONTRACT_ADDR) {
    throw new Error("NEXT_PUBLIC_INFT_CONTRACT_ADDR not set");
  }
  const data = encodeFunctionData({
    abi: AUTHORIZE_USAGE_ABI,
    functionName: "authorizeUsage",
    args: [args.tokenId, args.renter, args.expiresAt],
  });
  const client = getWalletClient();
  return client.sendTransaction({
    account: from,
    to: INFT_CONTRACT_ADDR,
    data,
    chain: { id: ZERO_G_GALILEO.chainId, name: ZERO_G_GALILEO.chainName, nativeCurrency: ZERO_G_GALILEO.nativeCurrency, rpcUrls: { default: { http: ZERO_G_GALILEO.rpcUrls } } },
  });
}

export default function WalletPage() {
  const T = useT();
  const { state: w, connect, busy } = useWallet();
  const [pools, setPools] = React.useState<Pool[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState<number | null>(null);
  const [lastTx, setLastTx] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await poolsApi.list();
        if (!cancelled) setPools(list);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const tokenized = (pools ?? []).filter(p => p.inft_token_id != null);

  async function onAuthorize(p: Pool) {
    if (!p.inft_token_id || !w.address) return;
    const renter = window.prompt("Renter wallet address (0x…)");
    if (!renter || !/^0x[0-9a-fA-F]{40}$/.test(renter)) {
      setErr("Renter must be a 0x-prefixed 40-char hex address");
      return;
    }
    const hoursStr = window.prompt("Authorize for how many hours?", "1");
    const hours = parseInt(hoursStr ?? "0", 10);
    if (!Number.isFinite(hours) || hours <= 0) {
      setErr("Hours must be a positive integer");
      return;
    }
    // eslint-disable-next-line react-hooks/purity -- Date.now() runs at click time, not during render
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + hours * 3600);
    try {
      setWorking(p.inft_token_id);
      setErr(null);
      const tx = await callAuthorizeUsage(
        { tokenId: BigInt(p.inft_token_id), renter: renter as `0x${string}`, expiresAt },
        w.address as `0x${string}`,
      );
      setLastTx(tx);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setWorking(null);
    }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <TopNav active="wallet"/>
      <section style={{ padding: "48px 64px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3, letterSpacing: "0.18em", textTransform: "uppercase" }}>Wallet</div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 40, color: T.text1, margin: "8px 0 0", letterSpacing: "-0.02em" }}>Your pool INFTs</h1>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2, marginTop: 8, maxWidth: 640 }}>
              Each loaded pool is tokenized as a PoolINFT (ERC-7857) on 0G Galileo. Authorize a renter to grant them inference access for a fixed window — the gate is enforced on-chain.
            </p>
          </div>
          {!w.address ? (
            <Button kind="primary" onClick={connect} disabled={busy}>
              {busy ? "Connecting…" : "Connect wallet"}
            </Button>
          ) : (
            <Badge kind="primary" label={`${w.address.slice(0, 6)}…${w.address.slice(-4)}`} />
          )}
        </div>

        {!INFT_CONTRACT_ADDR && (
          <Card style={{ marginBottom: 16, padding: 16, borderColor: T.amber }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.amber, letterSpacing: "0.1em" }}>SETUP</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text2, marginTop: 6 }}>
              Set <code style={{ fontFamily: FONT_MONO }}>NEXT_PUBLIC_INFT_CONTRACT_ADDR</code> to the deployed PoolINFT address before authorize calls will work.
            </div>
          </Card>
        )}
        {err && (
          <Card style={{ marginBottom: 16, padding: 16, borderColor: T.red }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.red }}>ERROR</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text1, marginTop: 6 }}>{err}</div>
          </Card>
        )}
        {lastTx && (
          <Card style={{ marginBottom: 16, padding: 16, borderColor: T.primary }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.primary }}>LAST TX</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2, marginTop: 6, wordBreak: "break-all" }}>{lastTx}</div>
          </Card>
        )}

        {pools === null && <div style={{ fontFamily: FONT_BODY, color: T.text2 }}>Loading pools…</div>}
        {pools !== null && tokenized.length === 0 && (
          <Card style={{ padding: 24 }}>
            <div style={{ fontFamily: FONT_BODY, color: T.text2 }}>
              No tokenized pools yet. INFTs are minted automatically when a pool reaches the <strong>loaded</strong> state.
            </div>
          </Card>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
          {tokenized.map(p => (
            <Card key={p.name} style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: T.text1, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2, marginTop: 4 }}>{p.model ?? "—"}</div>
                </div>
                <Badge kind="primary" label={`#${p.inft_token_id}`} />
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text3, marginBottom: 16, wordBreak: "break-all" }}>
                {p.inft_metadata_uri ?? "—"}
              </div>
              <Button
                kind="secondary"
                onClick={() => onAuthorize(p)}
                disabled={!w.address || working === p.inft_token_id}
              >
                {working === p.inft_token_id ? "Submitting…" : "Authorize renter"}
              </Button>
            </Card>
          ))}
        </div>
      </section>
      <Footer/>
    </div>
  );
}
