"use client";

export function SlashBanner({ visible }: { visible: boolean }) {
  return (
    <div
      className={[
        "pointer-events-none absolute left-1/2 top-1/2 z-10 w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 bg-[var(--red)] px-7 py-3 text-center font-mono text-[13px] font-bold uppercase tracking-[0.08em] text-white transition-all duration-[400ms]",
        "shadow-[0_8px_40px_rgba(255,79,110,0.4)] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        visible ? "scale-100 opacity-100" : "scale-[0.8] opacity-0",
      ].join(" ")}
    >
      ⚡ Slashing tx fired
      <small className="mt-1 block font-sans text-[12px] font-normal normal-case tracking-normal opacity-90">
        Shard-3 returned wrong activation · KeeperHub guaranteed execution
      </small>
    </div>
  );
}
