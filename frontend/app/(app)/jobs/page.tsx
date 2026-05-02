import Link from "next/link";
import { AppPage } from "@/components/layout/AppPage";
import { JobsListClient } from "@/components/jobs/JobsListClient";

export default function JobsPage() {
  return (
    <AppPage>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-[30px] leading-tight text-[var(--text)]"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            My Jobs
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
            Inference jobs submitted by your account
          </p>
        </div>
        <Link
          href="/jobs/new"
          className="px-4 py-2 bg-[var(--green)] text-black font-mono text-[10px] font-bold uppercase tracking-[0.08em] rounded hover:opacity-90 transition-opacity"
        >
          + Post Job
        </Link>
      </div>

      <div className="rounded border border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_100px_90px_80px] gap-4 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-panel)]">
          {["Request ID", "Pool", "Cost (USDC)", "Status", "Source"].map((h) => (
            <span
              key={h}
              className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]"
            >
              {h}
            </span>
          ))}
        </div>
        <JobsListClient />
      </div>

      <p className="mt-6 font-mono text-[10px] text-[var(--text-faint)]">
        Live data: orchestrator · 0G Galileo · 0G Storage
      </p>
    </AppPage>
  );
}
