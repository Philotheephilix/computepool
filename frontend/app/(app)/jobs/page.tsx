import Link from "next/link";

export default function JobsPage() {
  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-[22px] text-[var(--text)]"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            My Jobs
          </h1>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Inference jobs submitted by your wallet
          </p>
        </div>
        <Link
          href="/jobs/new"
          className="px-4 py-2 bg-[var(--green)] text-black text-[10px] font-bold uppercase tracking-[0.12em] rounded hover:opacity-90 transition-opacity"
        >
          + Post Job
        </Link>
      </div>

      <div className="rounded border border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_100px_90px_80px] gap-4 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-panel)]">
          {["Job ID", "Model", "Budget", "Status", "Settled"].map((h) => (
            <span key={h} className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.12em]">
              {h}
            </span>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-[var(--bg-panel)]">
          <span className="text-[var(--text-faint)] text-[11px] uppercase tracking-[0.12em]">
            No jobs yet
          </span>
          <Link
            href="/jobs/new"
            className="text-[11px] text-[var(--green)] hover:underline"
          >
            Post your first inference job →
          </Link>
        </div>
      </div>

      <div className="mt-6 p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.1em]">Demo job</span>
          <span className="text-[12px] text-[var(--text)]">job_0x91c4 · Llama-7B</span>
        </div>
        <div className="flex-1" />
        <span className="text-[10px] px-2 py-1 rounded border border-[#00ff9c33] text-[var(--green)] bg-[#00ff9c0a]">
          settled
        </span>
        <Link
          href="/jobs/demo"
          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          View →
        </Link>
      </div>
    </div>
  );
}
