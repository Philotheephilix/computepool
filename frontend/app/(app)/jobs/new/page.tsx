import { Suspense } from "react";
import Link from "next/link";
import { AppPage } from "@/components/layout/AppPage";
import { JobForm } from "@/components/jobs/JobForm";

export default function NewJobPage() {
  return (
    <AppPage narrow>
      <Link
        href="/jobs"
        className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em] hover:text-[var(--text-muted)] transition-colors mb-4 block"
      >
        ← My Jobs
      </Link>

      <h1
        className="text-[30px] leading-tight text-[var(--text)] mb-1"
        style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
      >
        Post a Job
      </h1>
      <p className="text-[13px] text-[var(--text-muted)] mb-8">
        Run inference against a loaded pool
      </p>

      <Suspense fallback={<div className="h-10 rounded border border-[var(--border)] bg-[var(--bg-panel)] animate-pulse" />}>
        <JobForm />
      </Suspense>
    </AppPage>
  );
}
