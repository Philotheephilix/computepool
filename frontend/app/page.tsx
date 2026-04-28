import { AXLMesh } from "@/components/mesh/AXLMesh";
import { AuctionArena } from "@/components/auction/AuctionArena";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-7 pb-[60px] pt-8">
      <header className="mb-7 flex items-end justify-between border-b border-[var(--border)] pb-6">
        <div className="max-w-[700px]">
          <h1 className="mb-1 text-[24px] font-medium tracking-[-0.02em]">
            ComputePool{" "}
            <span
              className="text-[28px] font-normal italic tracking-normal text-[var(--green)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              — a market of intelligent NFTs.
            </span>
          </h1>
          <p className="text-[12px] text-[var(--text-muted)]">
            Shard agents negotiate jobs over an encrypted P2P mesh, form
            coalitions, execute distributed inference, and earn royalties for
            their owners on every win.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--green)] shadow-[0_0_0_0_var(--green)] [animation:pulse_1.6s_infinite]" />
            <span>Live demo · auto-replay</span>
          </div>
          <div className="flex gap-2">
            <button className="border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--text)] transition-colors hover:border-[var(--green)] hover:text-[var(--green)]">
              ▶ Play
            </button>
            <button className="border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--text)] transition-colors hover:border-[var(--green)] hover:text-[var(--green)]">
              ↻ Reset
            </button>
          </div>
        </div>
      </header>

      <AXLMesh />

      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1.1fr_1.4fr]">
        <AuctionArena />

        <section className="overflow-hidden border border-[var(--border)] bg-[var(--bg-panel)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <span>◆ Pipeline Execution</span>
            <div className="flex gap-[18px]">
              <span>
                Tokens/s <b className="ml-1 font-medium text-[var(--text)]">0</b>
              </span>
              <span>
                Layer <b className="ml-1 font-medium text-[var(--text)]">—</b>
              </span>
            </div>
          </div>
          <div className="flex h-[380px] items-center justify-center text-[11px] text-[var(--text-muted)]">
            Pipeline view coming next.
          </div>
        </section>
      </div>
    </div>
  );
}
