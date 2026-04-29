import Link from "next/link";

export default function NewJobPage() {
  return (
    <div className="px-8 py-8 max-w-xl">
      <Link
        href="/jobs"
        className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.14em] hover:text-[var(--text-muted)] transition-colors mb-4 block"
      >
        ← My Jobs
      </Link>

      <h1
        className="text-[22px] text-[var(--text)] mb-1"
        style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
      >
        Post a Job
      </h1>
      <p className="text-[11px] text-[var(--text-muted)] mb-8">
        Broadcast an inference request to the shard marketplace
      </p>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">
            Model
          </label>
          <div className="px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text-faint)] flex items-center justify-between">
            <span>Llama-7B · 32 layers</span>
            <span>↕</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">
            Max Budget (ETH)
          </label>
          <div className="px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text-faint)]">
            0.95
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">
            SLA Deadline (seconds)
          </label>
          <div className="px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text-faint)]">
            30
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">
            Prompt
          </label>
          <div className="px-3 py-3 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text-faint)] min-h-[80px]">
            Explain distributed AI inference in one paragraph.
          </div>
        </div>

        <div className="p-3 rounded border border-[var(--border-soft)] bg-[var(--bg-elev)] text-[10px] text-[var(--text-faint)] leading-relaxed">
          Job will be broadcast over AXL to all registered shards. Coalitions have 30s to bid.
          Settlement via KeeperHub on-chain.
        </div>

        <Link
          href="/jobs/demo"
          className="px-4 py-3 bg-[var(--green)] text-black text-[11px] font-bold uppercase tracking-[0.12em] rounded text-center hover:opacity-90 transition-opacity"
        >
          Broadcast Job →
        </Link>
      </div>

      <p className="mt-6 text-[10px] text-[var(--text-faint)] text-center uppercase tracking-[0.1em]">
        Full form with 0G integration — task 3
      </p>
    </div>
  );
}
