"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { injected } from "wagmi";
import { formatUnits } from "viem";
import { isGalileoChain } from "@/lib/wagmi";
import { loadJobs, totalSpendUsdc, type StoredJob } from "@/lib/job-store";

function SimPill() {
  return (
    <span className="ml-1.5 px-1.5 py-0.5 rounded font-mono text-[10px] uppercase tracking-[0.08em] border border-[#ff9c0044] text-[#ff9c00] bg-[#ff9c000d]">
      simulated
    </span>
  );
}

function RealPill() {
  return (
    <span className="ml-1.5 px-1.5 py-0.5 rounded font-mono text-[10px] uppercase tracking-[0.08em] border border-[#00ff9c44] text-[var(--green)] bg-[#00ff9c0d]">
      real onchain
    </span>
  );
}

const FAKE_NFTS = [
  { id: "#07", model: "Llama-7B", layers: "21–30", rep: 96 },
  { id: "#02", model: "Llama-7B", layers: "0–10",  rep: 89 },
  { id: "#05", model: "Qwen-3B",  layers: "21–30", rep: 94 },
];

function StatCard({ label, value, sub, color = "var(--green)" }: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-1">
      <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">{label}</span>
      <span className="font-mono text-[20px] tabular-nums" style={{ color }}>{value}</span>
      {sub && <span className="text-[12px] text-[var(--text-faint)]">{sub}</span>}
    </div>
  );
}

export function WalletClient() {
  const { address, isConnected, chain } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const { data: balance } = useBalance({
    address,
    chainId: chain?.id,
    query: { enabled: isGalileoChain(chain?.id) },
  });

  const [jobs, setJobs] = useState<StoredJob[]>([]);
  const [spend, setSpend] = useState(0);

  useEffect(() => {
    setJobs(loadJobs().slice(0, 5));
    setSpend(totalSpendUsdc());
  }, []);

  const onWrongChain = isConnected && !isGalileoChain(chain?.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1
          className="text-[30px] leading-tight text-[var(--text)]"
          style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
        >
          My Wallet
        </h1>
        <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
          On-chain identity, iNFT holdings, and inference spend
        </p>
      </div>

      {/* Wallet connection */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">Wallet</span>
          <RealPill />
        </div>

        {isConnected && address ? (
          <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[var(--green)] shrink-0" style={{ animation: "pulse 2s infinite" }} />
              <span className="text-[13px] text-[var(--text)] font-mono truncate">{address}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-elev)] flex flex-col gap-0.5">
                <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">Network</span>
                <span className="text-[13px] text-[var(--text)]">{chain?.name ?? "—"}</span>
                {onWrongChain && (
                  <span className="text-[11px] text-[var(--red)]">Switch to 0G Galileo</span>
                )}
              </div>
              <div className="p-3 rounded border border-[var(--border)] bg-[var(--bg-elev)] flex flex-col gap-0.5">
                <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">Balance</span>
                <span className="font-mono text-[13px] text-[var(--green)] tabular-nums">
                  {balance
                    ? `${parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} ${balance.symbol}`
                    : onWrongChain ? "— (wrong chain)" : "—"}
                </span>
              </div>
            </div>

            <button
              onClick={() => disconnect()}
              className="self-start font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em] hover:text-[var(--red)] transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-3">
            <span className="text-[14px] text-[var(--text-muted)]">No wallet connected.</span>
            <button
              onClick={() => connect({ connector: injected() })}
              disabled={isPending}
              className="self-start px-4 py-2 border border-[var(--border-soft)] text-[var(--text)] font-mono text-[10px] uppercase tracking-[0.08em] rounded hover:bg-[var(--bg-elev)] transition-colors disabled:opacity-50"
            >
              {isPending ? "Connecting…" : "Connect MetaMask →"}
            </button>
          </div>
        )}
      </section>

      {/* iNFT Holdings — simulated */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">iNFT Holdings · ERC-7857</span>
          <SimPill />
        </div>
        <p className="text-[12px] text-[var(--text-faint)] mb-3 leading-relaxed">
          ERC-7857 on-chain minting is not yet deployed. Holdings shown are illustrative.
        </p>

        <div className="flex flex-col gap-2">
          {FAKE_NFTS.map((nft) => {
            const repColor = nft.rep >= 92 ? "var(--green)" : nft.rep >= 85 ? "var(--yellow)" : "var(--red)";
            return (
              <div
                key={nft.id}
                className="flex items-center gap-4 p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--border-soft)] transition-colors"
              >
                <div className="w-9 h-9 rounded border border-[var(--border-soft)] bg-[var(--bg-elev)] flex items-center justify-center text-[11px] text-[var(--green)] shrink-0 font-mono">
                  {nft.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--text)] truncate">
                    {nft.model} · layers <span className="font-mono">{nft.layers}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1 rounded-full bg-[var(--bg-elev)] max-w-[80px]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${nft.rep}%`, backgroundColor: repColor }}
                      />
                    </div>
                    <span className="font-mono text-[10px] tabular-nums" style={{ color: repColor }}>rep {nft.rep}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">ERC-7857</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Inference spend */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">Inference Spend</span>
          <span className="ml-1.5 px-1.5 py-0.5 rounded font-mono text-[10px] uppercase tracking-[0.08em] border border-[#0088ff44] text-[#0088ff] bg-[#0088ff0d]">
            real backend
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            label="Total Spend"
            value={`${spend.toFixed(6)} USDC`}
            sub={`${jobs.length} job${jobs.length !== 1 ? "s" : ""} recorded`}
          />
          <StatCard
            label="Jobs Run"
            value={String(jobs.length)}
            sub="stored locally"
            color="var(--text)"
          />
        </div>

        {jobs.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {jobs.map((j) => (
              <Link
                key={j.request_id}
                href={`/jobs/${j.request_id}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--border-soft)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--text)] truncate">{j.pool}</div>
                  <div className="text-[12px] text-[var(--text-faint)] mt-0.5">
                    {new Date(j.created_at).toLocaleString()} · <span className="font-mono tabular-nums">{j.tokens ?? "?"}</span> tokens
                  </div>
                </div>
                <span className="font-mono text-[12px] text-[var(--green)] shrink-0 tabular-nums">
                  {j.cost_usdc.toFixed(6)} USDC
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-5 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-center">
            <p className="text-[13px] text-[var(--text-muted)] mb-3">No inference jobs yet.</p>
            <Link
              href="/jobs/new"
              className="inline-block px-4 py-2 border border-[var(--border-soft)] text-[var(--text-muted)] font-mono text-[10px] uppercase tracking-[0.08em] rounded hover:border-[var(--border)] hover:text-[var(--text)] transition-colors"
            >
              Post a Job →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
