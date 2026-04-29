"use client";

export function Header({
  playing,
  onPlay,
  onReset,
}: {
  playing: boolean;
  onPlay: () => void;
  onReset: () => void;
}) {
  return (
    <header className="mb-7 flex items-end justify-between border-b border-[var(--border)] pb-6">
      <div className="max-w-[700px]">
        <h1
          className="mb-1 text-[32px] leading-tight italic text-[var(--text)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          ComputePool
          <span className="ml-2 text-[var(--green)]">— a market of intelligent NFTs.</span>
        </h1>
        <p className="max-w-[520px] text-[14px] leading-relaxed text-[var(--text-muted)]">
          Shard agents negotiate jobs over an encrypted P2P mesh, form coalitions,
          execute distributed inference, and earn royalties for their owners on
          every win.
        </p>
      </div>
      <div className="flex flex-col items-end gap-2.5">
        <div className="flex items-center gap-3.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          <span className="h-2 w-2 rounded-full bg-[var(--green)] [animation:pulse_1.6s_infinite]" />
          <span>Live demo · auto-replay</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPlay}
            className={[
              "border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors",
              playing
                ? "border-[var(--green)] text-[var(--green)]"
                : "border-[var(--border-soft)] bg-[var(--bg-elev)] text-[var(--text)] hover:border-[var(--green)] hover:text-[var(--green)]",
            ].join(" ")}
          >
            ▶ Play
          </button>
          <button
            type="button"
            onClick={onReset}
            className="border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text)] transition-colors hover:border-[var(--green)] hover:text-[var(--green)]"
          >
            ↻ Reset
          </button>
        </div>
      </div>
    </header>
  );
}
