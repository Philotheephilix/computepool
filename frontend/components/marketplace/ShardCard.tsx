import { ShardArt } from "./ShardArt";
import type { NodeCard } from "@/lib/marketplace";
import { LAYER_GROUP_COLOR, STATUS_COLOR, STATUS_LABEL } from "@/lib/marketplace";
import type { RepSummary } from "@/lib/reputation";

export function ShardCard({
  card,
  rep,
  selected,
  onClick,
}: {
  card: NodeCard;
  rep: RepSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const accentColor = LAYER_GROUP_COLOR[card.layerGroup];
  const statusColor = STATUS_COLOR[card.status];
  const layerLabel = card.layers ? `L ${card.layers[0]}–${card.layers[1]}` : "—";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded border transition-colors flex flex-col gap-3 ${
        selected
          ? "border-[var(--border-soft)] bg-[var(--bg-elev)]"
          : "border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--border-soft)] hover:bg-[var(--bg-elev)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <ShardArt num={card.num} layerGroup={card.layerGroup} size={64} />
        <div className="flex-1 min-w-0 flex flex-col gap-1 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-mono text-[var(--text)] truncate">
              {card.node_id.slice(0, 8)}…{card.node_id.slice(-6)}
            </span>
            <span
              className="font-mono text-[10px] px-1.5 py-0.5 rounded border shrink-0"
              style={{
                color: accentColor,
                borderColor: `${accentColor}44`,
                background: `${accentColor}0d`,
              }}
            >
              {layerLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: statusColor }}
            />
            <span className="text-[12px]" style={{ color: statusColor }}>
              {STATUS_LABEL[card.status]}
            </span>
          </div>

          {card.model && (
            <span className="font-mono text-[11px] text-[var(--text-faint)] truncate">
              {card.model}
            </span>
          )}
        </div>
      </div>

      {rep.count > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
            <span>Reputation</span>
            <span className="tabular-nums">{rep.winRate.toFixed(0)}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-[var(--bg-elev)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${rep.winRate}%`,
                background:
                  rep.winRate >= 92
                    ? "var(--green)"
                    : rep.winRate >= 75
                    ? "var(--yellow)"
                    : "var(--red)",
              }}
            />
          </div>
        </div>
      )}

      {card.axl_peer_id && (
        <div className="font-mono text-[10px] text-[var(--text-faint)] truncate">
          {card.axl_peer_id.slice(0, 24)}…
        </div>
      )}
    </button>
  );
}
