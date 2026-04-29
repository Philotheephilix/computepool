import Link from "next/link";
import { ShardArt } from "./ShardArt";
import type { ShardListing } from "@/lib/marketplace";
import { LAYER_GROUP_COLOR, STATUS_COLOR, STATUS_LABEL } from "@/lib/marketplace";

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ShardDrawer({
  shard,
  onClose,
}: {
  shard: ShardListing;
  onClose: () => void;
}) {
  const accent = LAYER_GROUP_COLOR[shard.layerGroup];
  const statusColor = STATUS_COLOR[shard.status];
  const wins = shard.winHistory.filter((h) => h === "w").length;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 h-full w-[340px] z-50 flex flex-col border-l border-[var(--border)] bg-[var(--bg-panel)] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <span
            className="text-[22px] text-[var(--text)]"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            Shard-{shard.num}
          </span>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors p-1"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5 flex-1">
          <div className="flex items-start gap-4">
            <ShardArt num={shard.num} layerGroup={shard.layerGroup} size={96} />
            <div className="flex flex-col gap-1.5 pt-1 min-w-0">
              <span
                className="font-mono text-[11px] px-2 py-0.5 rounded border self-start"
                style={{
                  color: accent,
                  borderColor: `${accent}44`,
                  background: `${accent}0d`,
                }}
              >
                {shard.layers}
              </span>
              <span className="font-mono text-[12px] text-[var(--text-muted)] break-all">
                {shard.tokenId}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]">ERC-7857</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: statusColor }}
                />
                <span className="text-[12px]" style={{ color: statusColor }}>
                  {STATUS_LABEL[shard.status]}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border)]" />

          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
              Reputation
            </span>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[22px] text-[var(--green)] tabular-nums">{shard.reputation}%</span>
              <span className="text-[12px] text-[var(--text-muted)]">
                <span className="font-mono tabular-nums">{wins}/{shard.winHistory.length}</span> wins
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--bg-elev)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${shard.reputation}%`,
                  background:
                    shard.reputation >= 92
                      ? "var(--green)"
                      : shard.reputation >= 85
                      ? "var(--yellow)"
                      : "var(--red)",
                }}
              />
            </div>
            <div className="flex gap-1 flex-wrap mt-1">
              {shard.winHistory.map((h, i) => (
                <span
                  key={i}
                  className="w-4 h-4 rounded-sm flex items-center justify-center font-mono text-[10px]"
                  style={{
                    background: h === "w" ? "#00ff9c1a" : "#ff4f6e1a",
                    color: h === "w" ? "var(--green)" : "var(--red)",
                    border: `1px solid ${h === "w" ? "#00ff9c33" : "#ff4f6e33"}`,
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)]" />

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Bid Price", value: `${shard.bidEth.toFixed(2)} ETH` },
              { label: "SLA", value: `${shard.slaSeconds}s` },
              { label: "SLA Reliability", value: `${Math.round(100 - shard.slashedCount * 2)}%` },
              { label: "Slashes", value: `${shard.slashedCount}` },
            ].map((s) => (
              <div
                key={s.label}
                className="p-3 rounded border border-[var(--border)] bg-[var(--bg-elev)] flex flex-col gap-1"
              >
                <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
                  {s.label}
                </span>
                <span className="font-mono text-[14px] text-[var(--text)] tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border)]" />

          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
              Compatible Models
            </span>
            <div className="flex gap-2 flex-wrap">
              {shard.models.map((m) => (
                <span
                  key={m}
                  className="px-2 py-1 rounded border border-[var(--border)] font-mono text-[11px] text-[var(--text-muted)]"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
              AXL Peer ID
            </span>
            <span className="font-mono text-[11px] text-[var(--text-muted)] break-all">
              {shard.axlPeerId}
            </span>
          </div>

          <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-[var(--border)]">
            <div className="p-3 rounded border border-[var(--border-soft)] bg-[var(--bg-elev)] text-[12px] text-[var(--text-faint)] leading-relaxed">
              Inviting this shard broadcasts a coalition request over AXL.
              It will respond with its current bid within the negotiation window.
            </div>
            <Link
              href="/jobs/new"
              className="block px-4 py-3 bg-[var(--green)] text-black font-mono text-[11px] font-bold uppercase tracking-[0.08em] rounded text-center hover:opacity-90 transition-opacity"
            >
              Invite to Coalition →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
