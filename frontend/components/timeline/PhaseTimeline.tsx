"use client";

const STEPS = [
  { n: "01", label: "Mesh idle" },
  { n: "02", label: "Job posted" },
  { n: "03", label: "Negotiation" },
  { n: "04", label: "Coalition wins" },
  { n: "05", label: "Pipeline executing" },
  { n: "06", label: "Slash & recover" },
  { n: "07", label: "Settle royalties" },
] as const;

export function PhaseTimeline({ activeStep }: { activeStep: number }) {
  return (
    <div className="mb-6 flex gap-px border border-[var(--border)] bg-[var(--border)]">
      {STEPS.map((s, i) => {
        const isActive = i === activeStep;
        const isDone = i < activeStep;
        return (
          <div
            key={s.n}
            className={[
              "relative flex-1 overflow-hidden px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-300",
              isActive
                ? "bg-[var(--bg-elev)] text-[var(--green)]"
                : "bg-[var(--bg-panel)] text-[var(--text-faint)]",
              isDone && !isActive ? "text-[var(--text-muted)]" : "",
            ].join(" ")}
          >
            <span className="mr-2 text-[var(--text-faint)]">{s.n}</span>
            {s.label}
            <span
              className={[
                "absolute bottom-0 left-0 h-0.5 transition-[width] duration-300",
                isActive ? "w-full bg-[var(--green)]" : "",
                isDone && !isActive ? "w-full bg-[var(--text-faint)]" : "",
                !isActive && !isDone ? "w-0 bg-[var(--green)]" : "",
              ].join(" ")}
            />
          </div>
        );
      })}
    </div>
  );
}
