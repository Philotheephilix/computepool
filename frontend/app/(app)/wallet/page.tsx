export default function WalletPage() {
  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1
          className="text-[22px] text-[var(--text)]"
          style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
        >
          My Wallet
        </h1>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
          Your iNFT portfolio, royalties, and reputation
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total Royalties", value: "0.2376 ETH", sub: "across 3 iNFTs" },
          { label: "Win Rate", value: "94%", sub: "last 30 days" },
          { label: "SLA Reliability", value: "98%", sub: "no recent slashes" },
        ].map((s) => (
          <div
            key={s.label}
            className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-1"
          >
            <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.12em]">
              {s.label}
            </span>
            <span className="text-[20px] text-[var(--green)]">{s.value}</span>
            <span className="text-[10px] text-[var(--text-faint)]">{s.sub}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.12em]">
          iNFT Holdings
        </span>
        {[
          { id: "#07", role: "Llama-7B · layers 21–30", rep: 96, eth: "0.2376" },
          { id: "#02", role: "Llama-7B · layers 0–10", rep: 89, eth: "0.1840" },
          { id: "#05", role: "Qwen-3B · layers 21–30", rep: 94, eth: "0.1210" },
        ].map((nft) => (
          <div
            key={nft.id}
            className="flex items-center gap-4 p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--border-soft)] transition-colors"
          >
            <div className="w-9 h-9 rounded border border-[var(--border-soft)] bg-[var(--bg-elev)] flex items-center justify-center text-[10px] text-[var(--green)] shrink-0">
              {nft.id}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-[var(--text)] truncate">{nft.role}</div>
              <div className="text-[10px] text-[var(--text-faint)] mt-0.5">
                ERC-7857 · rep {nft.rep}%
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[13px] text-[var(--green)]">{nft.eth} ETH</div>
              <div className="text-[9px] text-[var(--text-faint)] mt-0.5 uppercase tracking-[0.1em]">
                royalties
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-[10px] text-[var(--text-faint)] uppercase tracking-[0.12em]">
        Live wallet via 0G iNFT SDK — task 4
      </p>
    </div>
  );
}
