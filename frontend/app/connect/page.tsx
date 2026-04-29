import Link from "next/link";

export default function ConnectPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full flex flex-col gap-6">

        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.14em] hover:text-[var(--text-muted)] transition-colors mb-2 block"
          >
            ← Back
          </Link>
          <h2
            className="text-[28px] text-[var(--text)]"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            Connect Wallet
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            Connect to register shards, post jobs, and collect royalties.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {[
            { label: "MetaMask", sub: "Browser extension" },
            { label: "WalletConnect", sub: "Mobile & desktop" },
            { label: "Coinbase Wallet", sub: "Self-custody" },
          ].map((w) => (
            <Link
              key={w.label}
              href="/marketplace"
              className="flex items-center justify-between px-4 py-3.5 rounded border border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--border-soft)] hover:bg-[var(--bg-elev)] transition-colors group"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[12px] text-[var(--text)]">{w.label}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{w.sub}</span>
              </div>
              <span className="text-[var(--text-faint)] group-hover:text-[var(--text-muted)] transition-colors text-[18px]">
                →
              </span>
            </Link>
          ))}
        </div>

        <p className="text-[10px] text-[var(--text-faint)] text-center leading-relaxed">
          Wallet integration via 0G iNFT SDK — coming soon.
          <br />
          All interactions are mocked in this demo.
        </p>

      </div>
    </main>
  );
}
