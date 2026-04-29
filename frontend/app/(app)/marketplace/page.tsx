export default function MarketplacePage() {
  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-[22px] text-[var(--text)]"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            Marketplace
          </h1>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Browse GPU shard iNFTs available for coalition
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.12em]">
            Sort: Reputation
          </span>
          <span className="text-[var(--text-faint)]">↕</span>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {["All Layers", "L 0–10", "L 11–20", "L 21–30", "L 31+"].map((f) => (
          <button
            key={f}
            className={`px-3 py-1 rounded text-[10px] uppercase tracking-[0.1em] border transition-colors ${
              f === "All Layers"
                ? "border-[var(--green)] text-[var(--green)] bg-[var(--bg-elev)]"
                : "border-[var(--border)] text-[var(--text-faint)] hover:border-[var(--border-soft)] hover:text-[var(--text-muted)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-3 opacity-40"
            style={{ animation: `pulse 2s ${i * 0.15}s infinite` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <div className="h-2.5 w-20 rounded bg-[var(--bg-elev)]" />
                <div className="h-2 w-14 rounded bg-[var(--bg-elev)]" />
              </div>
              <div className="h-5 w-10 rounded bg-[var(--bg-elev)]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-2 w-full rounded bg-[var(--bg-elev)]" />
              <div className="h-2 w-3/4 rounded bg-[var(--bg-elev)]" />
            </div>
            <div className="h-7 w-full rounded bg-[var(--bg-elev)]" />
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-[10px] text-[var(--text-faint)] uppercase tracking-[0.12em]">
        Interactive marketplace — task 2
      </p>
    </div>
  );
}
