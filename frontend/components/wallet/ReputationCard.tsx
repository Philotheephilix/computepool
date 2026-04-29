"use client";

export function ReputationCard({
  winPct,
  slaPct,
  winWarn,
  history,
}: {
  winPct: number;
  slaPct: number;
  winWarn: boolean;
  history: string;
}) {
  const tiles = history.split("").filter(Boolean);

  return (
    <div className="border-l border-[var(--border-soft)] pl-6 max-md:border-l-0 max-md:border-t max-md:border-[var(--border-soft)] max-md:pl-0 max-md:pt-3.5">
      <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">
        Reputation
      </div>
      <div className="mb-3 flex justify-between text-[13px]">
        <span>Win rate</span>
        <span
          className={[
            "font-mono font-medium text-[var(--text)] tabular-nums",
            winWarn ? "text-[var(--yellow)]" : "",
          ].join(" ")}
        >
          {winPct}%
        </span>
      </div>
      <div
        className={[
          "relative mb-1.5 h-1 overflow-hidden bg-[var(--border-soft)]",
        ].join(" ")}
      >
        <div
          className={[
            "absolute inset-y-0 left-0 bg-[var(--green)] transition-[width,background-color] duration-500",
            winWarn ? "!bg-[var(--yellow)]" : "",
          ].join(" ")}
          style={{ width: `${winPct}%` }}
        />
      </div>
      <div className="mb-3 mt-2 flex justify-between text-[13px]">
        <span>SLA reliability</span>
        <span className="font-mono font-medium text-[var(--text)] tabular-nums">{slaPct}%</span>
      </div>
      <div className="relative mb-1.5 h-1 overflow-hidden bg-[var(--border-soft)]">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--green)] transition-[width] duration-500"
          style={{ width: `${slaPct}%` }}
        />
      </div>
      <div className="mt-3 flex gap-0.5">
        {tiles.map((x, i) => (
          <span
            key={i}
            className={[
              "inline-flex h-3.5 w-3.5 items-center justify-center border border-[var(--border-soft)] font-mono text-[10px] text-[var(--text-faint)]",
              x === "w"
                ? "border-[var(--green)] bg-[var(--green)] text-[var(--bg)]"
                : "",
              x === "l" ? "border-[var(--red)] bg-[var(--red)] text-white" : "",
            ].join(" ")}
          >
            {x === "w" ? "✓" : "✗"}
          </span>
        ))}
      </div>
    </div>
  );
}
