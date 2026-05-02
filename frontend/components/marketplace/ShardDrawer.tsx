import Link from "next/link";
import { ShardArt } from "./ShardArt";
import type { NodeCard } from "@/lib/marketplace";
import { LAYER_GROUP_COLOR, STATUS_COLOR, STATUS_LABEL } from "@/lib/marketplace";
import type { RepSummary } from "@/lib/reputation";

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ShardDrawer({
  card,
  rep,
  loadedPools = [],
  onClose,
}: {
  card: NodeCard;
  rep: RepSummary;
  loadedPools?: string[];
  onClose: () => void;
}) {
  const accent = LAYER_GROUP_COLOR[card.layerGroup];
  const statusColor = STATUS_COLOR[card.status];
  const layerLabel = card.layers ? `L ${card.layers[0]}–${card.layers[1]}` : "—";
  const canPreFill = card.pool_name != null && loadedPools.includes(card.pool_name);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      <div className="fixed top-0 right-0 h-full w-[340px] z-50 flex flex-col border-l border-[var(--border)] bg-[var(--bg-panel)] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <span
            className="text-[22px] text-[var(--text)]"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            Node
          </span>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors p-1"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5 flex-1">
          {/* Header */}
          <div className="flex items-start gap-4">
            <ShardArt num={card.num} layerGroup={card.layerGroup} size={96} />
            <div className="flex flex-col gap-1.5 pt-1 min-w-0">
              <span
                className="font-mono text-[11px] px-2 py-0.5 rounded border self-start"
                style={{ color: accent, borderColor: `${accent}44`, background: `${accent}0d` }}
              >
                {layerLabel}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)] break-all">
                {card.node_id}
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor }} />
                <span className="text-[12px]" style={{ color: statusColor }}>
                  {STATUS_LABEL[card.status]}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border)]" />

          {/* Details */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Model",     value: card.model ?? "—" },
              { label: "Pool",      value: card.pool_name ?? "—" },
              { label: "Role",      value: card.role ?? "—" },
              { label: "Last Seen", value: card.last_seen ? new Date(card.last_seen).toLocaleTimeString() : "—" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded border border-[var(--border)] bg-[var(--bg-elev)] flex flex-col gap-1">
                <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
                  {s.label}
                </span>
                <span className="font-mono text-[13px] text-[var(--text)] truncate">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Reputation — only when earned */}
          {rep.count > 0 && (
            <>
              <div className="border-t border-[var(--border)]" />
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
                  Reputation
                </span>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[22px] text-[var(--green)] tabular-nums">
                    {rep.winRate.toFixed(0)}%
                  </span>
                  <span className="text-[12px] text-[var(--text-muted)]">
                    <span className="font-mono tabular-nums">
                      {rep.winHistory.filter((h) => h === "w").length}/{rep.winHistory.length}
                    </span>{" "}
                    wins
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--bg-elev)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${rep.winRate}%`,
                      background:
                        rep.winRate >= 92 ? "var(--green)" : rep.winRate >= 75 ? "var(--yellow)" : "var(--red)",
                    }}
                  />
                </div>
                <div className="flex gap-1 flex-wrap mt-1">
                  {rep.winHistory.map((h, i) => (
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
            </>
          )}

          {/* AXL Peer ID */}
          {card.axl_peer_id && (
            <>
              <div className="border-t border-[var(--border)]" />
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
                  AXL Peer ID
                </span>
                <span className="font-mono text-[11px] text-[var(--text-muted)] break-all">
                  {card.axl_peer_id}
                </span>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-[var(--border)]">
            {canPreFill ? (
              <Link
                href={`/jobs/new?pool=${encodeURIComponent(card.pool_name!)}`}
                className="block px-4 py-3 bg-[var(--green)] text-black font-mono text-[11px] font-bold uppercase tracking-[0.08em] rounded text-center hover:opacity-90 transition-opacity"
              >
                Use in Next Job →
              </Link>
            ) : (
              <div className="p-3 rounded border border-[var(--border-soft)] bg-[var(--bg-elev)] text-[12px] text-[var(--text-faint)] leading-relaxed">
                {card.status === "executing"
                  ? "Node is currently executing inference."
                  : card.status === "slashed"
                  ? "Node has been slashed and is unavailable."
                  : "Node is available. Post a job to include it in a coalition."}
              </div>
            )}
            <Link
              href="/jobs/new"
              className="block px-4 py-3 border border-[var(--border-soft)] text-[var(--text-muted)] font-mono text-[11px] uppercase tracking-[0.08em] rounded text-center hover:border-[var(--border)] hover:text-[var(--text)] transition-colors"
            >
              Post a Job →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
