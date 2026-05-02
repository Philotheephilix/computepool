"use client";

const KEEPERHUB_URL = process.env.NEXT_PUBLIC_KEEPERHUB_RUN_URL;
const KEEPERHUB_TX = process.env.NEXT_PUBLIC_KEEPERHUB_TX_HASH;

export function SlashBanner({ visible }: { visible: boolean }) {
  return (
    <div
      className={[
        "pointer-events-none absolute left-1/2 top-1/2 z-10 w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 bg-[var(--red)] px-7 py-3 text-center font-mono text-[13px] font-bold uppercase tracking-[0.08em] text-white transition-all duration-[400ms]",
        "shadow-[0_8px_40px_rgba(255,79,110,0.4)] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        visible ? "scale-100 opacity-100 pointer-events-auto" : "scale-[0.8] opacity-0",
      ].join(" ")}
    >
      ⚡ Slashing tx fired
      <small className="mt-1 block font-sans text-[12px] font-normal normal-case tracking-normal opacity-90">
        Shard-3 returned wrong activation · KeeperHub guaranteed execution
        {KEEPERHUB_TX ? (
          <> · tx <code className="font-mono">{KEEPERHUB_TX.slice(0, 10)}…</code></>
        ) : null}
      </small>
      {KEEPERHUB_URL ? (
        <a
          href={KEEPERHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[11px] font-sans font-normal normal-case tracking-normal underline opacity-80 hover:opacity-100"
        >
          View workflow on KeeperHub →
        </a>
      ) : null}
    </div>
  );
}
