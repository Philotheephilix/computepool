import Link from "next/link";

const PHASES = [
  { num: "01", label: "Register Shard", desc: "Mint your GPU as an iNFT via ERC-7857" },
  { num: "02", label: "Post Job", desc: "Broadcast an inference request with budget" },
  { num: "03", label: "Negotiate", desc: "Shard agents bid and form coalitions over AXL" },
  { num: "04", label: "Commit", desc: "Winning coalition locks a smart-contract bond" },
  { num: "05", label: "Execute", desc: "Activations stream through the 0G pipeline" },
  { num: "06", label: "Settle", desc: "KeeperHub pays per-block, slashes bad actors" },
];

const STACK = ["0G iNFT · ERC-7857", "Gensyn AXL", "0G Storage", "0G Compute", "KeeperHub"];

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-2xl w-full flex flex-col items-center text-center gap-10">

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-soft)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--green)] inline-block"
            style={{ animation: "pulse 2s infinite" }}
          />
          OpenAgents 2026 · Hackathon
        </div>

        <div className="flex flex-col gap-4">
          <h1
            className="text-[64px] leading-none text-[var(--text)]"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            ComputePool
          </h1>
          <p className="text-[16px] text-[var(--text-muted)] leading-relaxed max-w-md mx-auto">
            A market of intelligent NFTs that bid against each other to run your AI model.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/connect"
            className="px-5 py-2.5 bg-[var(--green)] text-black font-mono text-[11px] font-bold uppercase tracking-[0.08em] rounded hover:opacity-90 transition-opacity"
          >
            Connect Wallet →
          </Link>
          <Link
            href="/jobs/demo"
            className="px-5 py-2.5 border border-[var(--border-soft)] text-[var(--text-muted)] font-mono text-[11px] uppercase tracking-[0.08em] rounded hover:border-[var(--border)] hover:text-[var(--text)] transition-colors"
          >
            Watch Live Demo
          </Link>
        </div>

        <div className="w-full border-t border-[var(--border)]" />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full text-left">
          {PHASES.map((phase) => (
            <div
              key={phase.num}
              className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-2 hover:border-[var(--border-soft)] transition-colors"
            >
              <span className="font-mono text-[10px] text-[var(--green)] uppercase tracking-[0.08em]">
                {phase.num}
              </span>
              <span className="text-[14px] font-medium text-[var(--text)]">{phase.label}</span>
              <span className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                {phase.desc}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          {STACK.map((s, i) => (
            <span
              key={i}
              className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em] px-2 py-1 border border-[var(--border)] rounded"
            >
              {s}
            </span>
          ))}
        </div>

      </div>
    </main>
  );
}
