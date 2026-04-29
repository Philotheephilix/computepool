import Link from "next/link";
import { AppPage } from "@/components/layout/AppPage";
import { JobForm } from "@/components/jobs/JobForm";

export default function NewJobPage() {
  return (
    <AppPage narrow>
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
        Run inference against a loaded pool
      </p>

      <JobForm />
    </AppPage>
  );
}
