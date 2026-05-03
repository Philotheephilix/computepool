"use client";

import * as React from "react";
import Link from "next/link";
import { useT, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "@/components/cp/theme";
import { TopNav, Footer } from "@/components/cp/top-nav";
import { Badge, Button } from "@/components/cp/primitives";
import { useWallet } from "@/lib/use-wallet";
import { pools as poolsApi, type Pool } from "@/lib/api";
import { getWalletClient, ZERO_G_GALILEO } from "@/lib/wallet";
import { useBreakpoint } from "@/lib/use-breakpoint";
import {
  encodeFunctionData,
  createPublicClient,
  http,
  type Hex,
  type PublicClient,
} from "viem";

const INFT_CONTRACT_ADDR = (process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDR ?? "") as `0x${string}`;
const EXPLORER = process.env.NEXT_PUBLIC_ZERO_G_CHAIN_EXPLORER ?? "https://chainscan-galileo.0g.ai";

const POOL_INFT_ABI = [
  {
    type: "function",
    name: "authorizeUsage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "user", type: "address" },
      { name: "expiresAt", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isAuthorized",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "pools",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "metadataHash", type: "bytes32" },
      { name: "metadataURI", type: "string" },
      { name: "sealedKey", type: "bytes" },
    ],
  },
] as const;

type ChainState = {
  owner: `0x${string}`;
  metadataHash: `0x${string}`;
  metadataURI: string;
  sealedKeyLen: number;
  isCallerAuthorized: boolean | null;
};

const publicClient: PublicClient = createPublicClient({
  transport: http(ZERO_G_GALILEO.rpcUrls[0]),
}) as unknown as PublicClient;

async function readChainState(tokenId: bigint, caller: string | null): Promise<ChainState> {
  const [owner, pool, isAuth] = await Promise.all([
    publicClient.readContract({
      address: INFT_CONTRACT_ADDR, abi: POOL_INFT_ABI, functionName: "ownerOf", args: [tokenId],
    }) as Promise<`0x${string}`>,
    publicClient.readContract({
      address: INFT_CONTRACT_ADDR, abi: POOL_INFT_ABI, functionName: "pools", args: [tokenId],
    }) as Promise<readonly [`0x${string}`, string, `0x${string}`]>,
    caller
      ? (publicClient.readContract({
          address: INFT_CONTRACT_ADDR, abi: POOL_INFT_ABI, functionName: "isAuthorized",
          args: [tokenId, caller as `0x${string}`],
        }) as Promise<boolean>)
      : Promise.resolve(null as boolean | null),
  ]);
  const [metadataHash, metadataURI, sealedKey] = pool;
  return {
    owner,
    metadataHash,
    metadataURI,
    sealedKeyLen: (sealedKey.length - 2) / 2,
    isCallerAuthorized: isAuth,
  };
}

async function callAuthorizeUsage(
  args: { tokenId: bigint; renter: `0x${string}`; expiresAt: bigint },
  from: `0x${string}`,
): Promise<Hex> {
  if (!INFT_CONTRACT_ADDR) throw new Error("NEXT_PUBLIC_INFT_CONTRACT_ADDR not set");
  const data = encodeFunctionData({
    abi: POOL_INFT_ABI, functionName: "authorizeUsage",
    args: [args.tokenId, args.renter, args.expiresAt],
  });
  const client = getWalletClient();
  return client.sendTransaction({
    account: from,
    to: INFT_CONTRACT_ADDR,
    data,
    chain: {
      id: ZERO_G_GALILEO.chainId,
      name: ZERO_G_GALILEO.chainName,
      nativeCurrency: ZERO_G_GALILEO.nativeCurrency,
      rpcUrls: { default: { http: ZERO_G_GALILEO.rpcUrls } },
    },
  });
}

function shortAddr(a: string | null | undefined, head = 6, tail = 4): string {
  if (!a) return "—";
  if (a.length <= head + tail + 2) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

function describeURI(uri: string): { label: string; bytes: number; preview: string } {
  if (uri.startsWith("data:")) {
    const [, b64] = uri.split(",");
    const bytes = b64 ? Math.floor((b64.length * 3) / 4) : 0;
    return { label: "Inline encrypted blob", bytes, preview: uri.slice(0, 56) + "…" };
  }
  if (uri.startsWith("0g://")) {
    return { label: "0G Storage", bytes: 0, preview: uri };
  }
  return { label: "URI", bytes: 0, preview: uri };
}

function LayerSplit({ pool }: { pool: Pool }) {
  const T = useT();
  const total = (pool.assignments ?? []).reduce(
    (acc, a) => Math.max(acc, a.layers[1]),
    0,
  );
  const entry = (pool.assignments ?? []).find(a => a.role === "entry");
  const exit_ = (pool.assignments ?? []).find(a => a.role === "exit");
  if (!total || !entry || !exit_) return null;
  const entryPct = ((entry.layers[1] - entry.layers[0]) / total) * 100;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: FONT_MONO, fontSize: 10, color: T.text3, letterSpacing: "0.08em",
        textTransform: "uppercase", marginBottom: 6 }}>
        <span>Layer split · {total} total</span>
        <span>{entry.layers[1]}/{total} → {exit_.layers[1] - exit_.layers[0]}</span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden",
        background: T.surfaceWarm, gap: 1.5 }}>
        <div style={{ width: `${entryPct}%`,
          background: `linear-gradient(90deg, ${T.primary}, ${T.primaryDeep})` }}/>
        <div style={{ flex: 1,
          background: `linear-gradient(90deg, ${T.primaryMid}, ${T.primaryLight})` }}/>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between",
        fontFamily: FONT_MONO, fontSize: 10, color: T.text2, marginTop: 6, flexWrap: "wrap", gap: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: T.primary }}/>
          entry · {entry.node_id} · L{entry.layers[0]}–{entry.layers[1] - 1}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          exit · {exit_.node_id} · L{exit_.layers[0]}–{exit_.layers[1] - 1}
          <span style={{ width: 6, height: 6, borderRadius: 3, background: T.primaryMid }}/>
        </span>
      </div>
    </div>
  );
}

function INFTCard({
  pool,
  callerWallet,
  onAuthorize,
  working,
}: {
  pool: Pool;
  callerWallet: string | null;
  onAuthorize: (p: Pool) => void;
  working: boolean;
}) {
  const T = useT();
  const [chain, setChain] = React.useState<ChainState | null>(null);
  const [chainErr, setChainErr] = React.useState<string | null>(null);

  const tokenId = pool.inft_token_id ?? 0;

  React.useEffect(() => {
    if (!INFT_CONTRACT_ADDR || !tokenId) return;
    let cancel = false;
    void (async () => {
      try {
        const s = await readChainState(BigInt(tokenId), callerWallet);
        if (!cancel) { setChain(s); setChainErr(null); }
      } catch (e) {
        if (!cancel) setChainErr((e as Error).message);
      }
    })();
    return () => { cancel = true; };
  }, [tokenId, callerWallet]);

  const uri = describeURI(pool.inft_metadata_uri ?? "");
  const isOwner = chain && callerWallet && chain.owner.toLowerCase() === callerWallet.toLowerCase();

  return (
    <div style={{
      position: "relative",
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 18,
      overflow: "hidden",
      transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px ${T.primary}1f`;
        e.currentTarget.style.borderColor = T.borderStrong;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
        e.currentTarget.style.borderColor = T.border;
      }}
    >
      <div style={{
        height: 4,
        background: `linear-gradient(90deg, ${T.primary}, ${T.primaryMid}, ${T.primary})`,
        backgroundSize: "200% 100%",
        animation: "cp-stripe 6s linear infinite",
      }}/>

      <div style={{ padding: "18px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: FONT_MONO, fontSize: 10, color: T.text3,
              letterSpacing: "0.18em", textTransform: "uppercase",
            }}>
              ERC-7857 · 0G Galileo · token #{tokenId}
            </div>
            <div style={{
              fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: T.text1,
              marginTop: 6, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {pool.name}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.text2, marginTop: 2 }}>
              {pool.model ?? "—"}
            </div>
          </div>

          <div style={{
            position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
            minWidth: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDeep})`,
            color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22,
            letterSpacing: "-0.02em",
            boxShadow: `0 0 0 4px ${T.primaryLight}`,
            flexShrink: 0,
          }}>
            <span style={{
              position: "absolute", inset: -6, borderRadius: 18,
              background: `radial-gradient(circle, ${T.primary}33, transparent 70%)`,
              animation: "cp-pulse 2.4s ease-in-out infinite",
            }}/>
            <span style={{ position: "relative" }}>#{tokenId}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {chain ? (
            <Badge kind="primary" label="On-chain · live"/>
          ) : chainErr ? (
            <Badge kind="amber" label="Chain read failed"/>
          ) : (
            <Badge kind="primary" label="Reading chain…"/>
          )}
          {chain && callerWallet && (
            isOwner
              ? <Badge kind="purple" label="You are the owner"/>
              : (chain.isCallerAuthorized
                  ? <Badge kind="primary" label="You are authorized"/>
                  : <Badge kind="offline" label="Not authorized"/>)
          )}
          <Badge kind="offline" label={uri.label}/>
        </div>

        <LayerSplit pool={pool}/>

        <div style={{
          marginTop: 14, padding: "12px 14px",
          background: T.surfaceWarm, borderRadius: 10,
          fontFamily: FONT_MONO, fontSize: 12, color: T.text2,
          display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 6, columnGap: 12,
        }}>
          <span style={{ color: T.text3 }}>Owner</span>
          <span style={{ color: T.text1, overflow: "hidden", textOverflow: "ellipsis" }}>
            <a href={`${EXPLORER}/address/${chain?.owner ?? ""}`} target="_blank" rel="noopener"
              style={{ color: T.text1, textDecoration: "none", borderBottom: `1px dashed ${T.border}` }}>
              {shortAddr(chain?.owner ?? "—", 8, 6)}
            </a>
          </span>
          <span style={{ color: T.text3 }}>Hash</span>
          <span style={{ color: T.text1, wordBreak: "break-all" }}>
            {chain ? shortAddr(chain.metadataHash, 10, 8) : "—"}
          </span>
          <span style={{ color: T.text3 }}>Sealed key</span>
          <span style={{ color: T.text1 }}>
            {chain ? `${chain.sealedKeyLen} bytes (ECIES)` : "—"}
          </span>
          <span style={{ color: T.text3 }}>Metadata</span>
          <span style={{ color: T.text1, overflow: "hidden", textOverflow: "ellipsis" }}>
            {uri.bytes ? `${uri.bytes} B encrypted` : uri.preview}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <Button kind="primary"
            onClick={() => onAuthorize(pool)}
            disabled={!callerWallet || working || !isOwner}>
            {working ? "Submitting…" : (isOwner ? "Authorize renter" : "Owner-only action")}
          </Button>
          <a href={`${EXPLORER}/token/${INFT_CONTRACT_ADDR}?a=${tokenId}`} target="_blank" rel="noopener"
            style={{ textDecoration: "none" }}>
            <Button kind="secondary">Open in explorer ↗</Button>
          </a>
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const T = useT();
  const isMobile = useBreakpoint();
  const { state: w, connect, busy } = useWallet();
  const [pools, setPools] = React.useState<Pool[] | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState<number | null>(null);
  const [lastTx, setLastTx] = React.useState<string | null>(null);

  const apiKey = typeof window !== "undefined" ? window.localStorage.getItem("cp_api_key") : null;

  React.useEffect(() => {
    let cancel = false;
    if (!apiKey) {
      void Promise.resolve().then(() => { if (!cancel) setPools([]); });
      return () => { cancel = true; };
    }
    void (async () => {
      try {
        const list = await poolsApi.list();
        if (!cancel) setPools(list);
      } catch (e) {
        if (!cancel) setLoadErr((e as Error).message);
      }
    })();
    return () => { cancel = true; };
  }, [apiKey]);

  const tokenized = (pools ?? []).filter(p => p.inft_token_id != null);

  async function onAuthorize(p: Pool) {
    if (!p.inft_token_id || !w.address) return;
    const renter = window.prompt("Renter wallet address (0x…)");
    if (!renter || !/^0x[0-9a-fA-F]{40}$/.test(renter)) {
      setLoadErr("Renter must be a 0x-prefixed 40-char hex address"); return;
    }
    const hoursStr = window.prompt("Authorize for how many hours?", "1");
    const hours = parseInt(hoursStr ?? "0", 10);
    if (!Number.isFinite(hours) || hours <= 0) {
      setLoadErr("Hours must be a positive integer"); return;
    }
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + hours * 3600);
    try {
      setWorking(p.inft_token_id);
      setLoadErr(null);
      const tx = await callAuthorizeUsage(
        { tokenId: BigInt(p.inft_token_id), renter: renter as `0x${string}`, expiresAt },
        w.address as `0x${string}`,
      );
      setLastTx(tx);
    } catch (e) {
      setLoadErr((e as Error).message);
    } finally {
      setWorking(null);
    }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <style>{`
        @keyframes cp-pulse { 0%,100% { opacity:1 } 50% { opacity:.45 } }
        @keyframes cp-stripe { 0% { background-position: 0 0 } 100% { background-position: 200% 0 } }
      `}</style>
      <TopNav active="wallet"/>

      <section style={{ padding: isMobile ? "24px 16px 16px" : "48px 64px 24px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{
          padding: isMobile ? "20px 16px" : "28px 32px",
          borderRadius: 20,
          border: `1px solid ${T.border}`,
          background: `linear-gradient(135deg, ${T.surface} 0%, ${T.surfaceWarm} 100%)`,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
          gap: 20, alignItems: "center",
        }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.primary,
              letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Pool INFTs · ERC-7857
            </div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 26 : 36, color: T.text1,
              margin: "10px 0 8px", letterSpacing: "-0.02em" }}>
              Your tokenized inference pools
            </h1>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2,
              maxWidth: 700, lineHeight: 1.5, margin: 0 }}>
              Each loaded pool is minted as a transferable NFT on 0G Galileo. The orchestrator stores AES-encrypted
              metadata off-chain and seals the AES key to your secp256k1 pubkey. Authorize a renter and the on-chain
              gate lets them call <code style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.text1 }}>/v1/chat/completions</code> against the pool for the duration you set.
            </p>
            {INFT_CONTRACT_ADDR && (
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <a href={`${EXPLORER}/address/${INFT_CONTRACT_ADDR}`} target="_blank" rel="noopener"
                  style={{ textDecoration: "none" }}>
                  <Badge kind="primary" label={`Contract · ${shortAddr(INFT_CONTRACT_ADDR, 8, 6)} ↗`}/>
                </a>
                <Badge kind="purple" label="0G Galileo · 16602"/>
              </div>
            )}
          </div>
          {/* Badge hidden on mobile to avoid squeezing text */}
          {!isMobile && (
            <div style={{
              position: "relative",
              width: 120, height: 120, borderRadius: 22,
              background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDeep})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 8px 24px ${T.primary}33`,
            }}>
              <div style={{
                position: "absolute", inset: -10, borderRadius: 28,
                background: `radial-gradient(circle, ${T.primary}33, transparent 70%)`,
                animation: "cp-pulse 2.4s ease-in-out infinite",
              }}/>
              <span style={{
                position: "relative", color: "#fff", fontFamily: FONT_DISPLAY,
                fontSize: 44, fontWeight: 700, letterSpacing: "-0.04em",
              }}>{tokenized.length}</span>
              <span style={{
                position: "absolute", bottom: 14,
                fontFamily: FONT_MONO, fontSize: 10, color: "rgba(255,255,255,0.85)",
                letterSpacing: "0.18em", textTransform: "uppercase",
              }}>INFTs</span>
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: isMobile ? "0 16px 48px" : "0 64px 64px", maxWidth: 1280, margin: "0 auto" }}>
        {!INFT_CONTRACT_ADDR && (
          <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 12,
            background: T.amberLight, border: `1px solid ${T.amber}55`, color: T.text1,
            fontFamily: FONT_BODY, fontSize: 13 }}>
            <strong style={{ fontFamily: FONT_MONO, color: T.amber, letterSpacing: "0.08em" }}>SETUP</strong>{" "}
            Set <code style={{ fontFamily: FONT_MONO }}>NEXT_PUBLIC_INFT_CONTRACT_ADDR</code> (in <code style={{ fontFamily: FONT_MONO }}>frontend/.env.local</code>) and restart <code style={{ fontFamily: FONT_MONO }}>npm run dev</code>.
          </div>
        )}
        {loadErr && (
          <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 12,
            background: T.redLight, border: `1px solid ${T.red}55`, color: T.text1,
            fontFamily: FONT_BODY, fontSize: 13 }}>
            <strong style={{ fontFamily: FONT_MONO, color: T.red }}>ERROR</strong> {loadErr}
          </div>
        )}
        {lastTx && (
          <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 12,
            background: T.primaryLight, border: `1px solid ${T.primary}55`,
            fontFamily: FONT_BODY, fontSize: 13, color: T.text1 }}>
            <strong style={{ fontFamily: FONT_MONO, color: T.primary, letterSpacing: "0.08em" }}>SUBMITTED</strong>{" "}
            <a href={`${EXPLORER}/tx/${lastTx}`} target="_blank" rel="noopener"
              style={{ fontFamily: FONT_MONO, color: T.primary }}>{shortAddr(lastTx, 10, 8)} ↗</a>
          </div>
        )}

        {!w.address && (
          <div style={{ marginBottom: 16, padding: 18, borderRadius: 12,
            background: T.surface, border: `1px dashed ${T.borderStrong}`,
            display: "flex", alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: T.text1, fontWeight: 600 }}>
                Connect your wallet to authorize renters
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: T.text2, marginTop: 4 }}>
                Authorize calls write to PoolINFT on 0G Galileo and require a connected wallet.
              </div>
            </div>
            <Button kind="primary" onClick={connect} disabled={busy} style={{ flexShrink: 0 }}>
              {busy ? "Connecting…" : "Connect wallet"}
            </Button>
          </div>
        )}

        {!apiKey && (
          <div style={{ padding: 32, borderRadius: 16, background: T.surface,
            border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: T.text1, marginBottom: 8 }}>
              Sign in to see your pools
            </div>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2, maxWidth: 480,
              margin: "0 auto 18px" }}>
              You need an orchestrator API key to list your pools. The INFTs themselves
              live on-chain, so you can also inspect any token in <a href={`${EXPLORER}/address/${INFT_CONTRACT_ADDR}`}
                target="_blank" rel="noopener" style={{ color: T.primary }}>the explorer</a> directly.
            </p>
            <Link href="/connect" style={{ textDecoration: "none" }}>
              <Button kind="primary">Go to /connect</Button>
            </Link>
          </div>
        )}

        {apiKey && pools === null && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(380px, 1fr))", gap: 18 }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                height: 320, borderRadius: 18, background: T.surface,
                border: `1px solid ${T.border}`,
                animation: "cp-pulse 1.6s ease-in-out infinite",
              }}/>
            ))}
          </div>
        )}

        {apiKey && pools !== null && tokenized.length === 0 && (
          <div style={{ padding: 32, borderRadius: 16, background: T.surface,
            border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: T.text1, marginBottom: 8 }}>
              No tokenized pools yet
            </div>
            <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: T.text2, maxWidth: 540, margin: "0 auto" }}>
              INFTs are minted automatically when a pool transitions to the <strong>loaded</strong> state. Initialize and load a pool to see it here.
            </p>
          </div>
        )}

        {apiKey && tokenized.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(380px, 1fr))", gap: 18 }}>
            {tokenized.map(p => (
              <INFTCard
                key={p.name}
                pool={p}
                callerWallet={w.address}
                working={working === p.inft_token_id}
                onAuthorize={onAuthorize}
              />
            ))}
          </div>
        )}
      </section>

      <Footer/>
    </div>
  );
}
