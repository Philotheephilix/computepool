"use client";

import { useEffect, useState } from "react";
import { ShardCard } from "./ShardCard";
import { ShardDrawer } from "./ShardDrawer";
import { useApiState } from "@/hooks/useApiState";
import {
  nodeToCard,
  sortCards,
  type LayerGroup,
  type NodeCard,
  type SortKey,
} from "@/lib/marketplace";
import { getReputation, type RepSummary } from "@/lib/reputation";

const LAYER_FILTERS: { label: string; value: LayerGroup | "all" }[] = [
  { label: "All",     value: "all"   },
  { label: "L 0–10",  value: "0-10"  },
  { label: "L 11–20", value: "11-20" },
  { label: "L 21–30", value: "21-30" },
  { label: "L 31+",   value: "31+"   },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "Status",    value: "status"    },
  { label: "Layer",     value: "layer-asc" },
  { label: "Last Seen", value: "last-seen" },
];

const EMPTY_REP: RepSummary = { winRate: 0, winHistory: [], slaPct: 0, count: 0 };

export function MarketplaceClient() {
  const { data, loading, error } = useApiState();
  const [layerFilter, setLayerFilter] = useState<LayerGroup | "all">("all");
  const [sortKey, setSortKey]         = useState<SortKey>("status");
  const [selected, setSelected]       = useState<NodeCard | null>(null);
  const [sortOpen, setSortOpen]       = useState(false);
  const [repMap, setRepMap]           = useState<Map<string, RepSummary>>(new Map());

  const allCards   = (data?.nodes ?? []).map(nodeToCard);
  const loadedPools = (data?.pools ?? []).filter((p) => p.loaded).map((p) => p.name);

  useEffect(() => {
    const cards = (data?.nodes ?? []).map(nodeToCard);
    const map = new Map<string, RepSummary>();
    for (const card of cards) {
      map.set(card.node_id, getReputation(card.node_id));
    }
    setRepMap(map);
  }, [data]);

  const filtered = layerFilter === "all" ? allCards : allCards.filter((c) => c.layerGroup === layerFilter);
  const visible  = sortCards(filtered, sortKey);

  const available   = allCards.filter((c) => c.status === "available").length;
  const inCoalition = allCards.filter((c) => c.status === "in-coalition").length;
  const executing   = allCards.filter((c) => c.status === "executing").length;

  const currentSort = SORT_OPTIONS.find((o) => o.value === sortKey)!;

  return (
    <>
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1
            className="text-[30px] leading-tight text-[var(--text)]"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            Marketplace
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
            {loading
              ? "Loading nodes…"
              : error === "unauthenticated"
              ? "Sign in to see live nodes"
              : `${allCards.length} nodes · onchain: 0G Galileo testnet`}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
            <span className="tabular-nums">{available}</span> available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--purple)]" />
            <span className="tabular-nums">{inCoalition}</span> coalition
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)]" />
            <span className="tabular-nums">{executing}</span> executing
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex gap-1.5 flex-wrap">
          {LAYER_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setLayerFilter(f.value)}
              className={`px-3 py-1 rounded font-mono text-[10px] uppercase tracking-[0.08em] border transition-colors ${
                layerFilter === f.value
                  ? "border-[var(--green)] text-[var(--green)] bg-[var(--bg-elev)]"
                  : "border-[var(--border)] text-[var(--text-faint)] hover:border-[var(--border-soft)] hover:text-[var(--text-muted)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1 rounded border border-[var(--border)] font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em] hover:border-[var(--border-soft)] hover:text-[var(--text)] transition-colors"
          >
            <span>{currentSort.label}</span>
            <span className="text-[var(--text-faint)]">↕</span>
          </button>
          {sortOpen && (
            <div className="absolute top-full right-0 mt-1 w-[140px] rounded border border-[var(--border-soft)] bg-[var(--bg-elev)] z-30 flex flex-col overflow-hidden">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => { setSortKey(o.value); setSortOpen(false); }}
                  className={`px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                    sortKey === o.value
                      ? "text-[var(--green)] bg-[var(--bg-panel)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-panel)]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded border border-[var(--border)] bg-[var(--bg-panel)] animate-pulse" />
          ))}
        </div>
      ) : error && error !== "unauthenticated" ? (
        <div className="p-5 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[13px] text-[var(--text-muted)]">
          Error loading nodes: {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="font-mono text-[11px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
            {allCards.length === 0
              ? error === "unauthenticated"
                ? "Sign in to see registered nodes"
                : "No nodes registered yet"
              : "No nodes for this filter"}
          </span>
          {allCards.length > 0 && layerFilter !== "all" && (
            <button
              onClick={() => setLayerFilter("all")}
              className="text-[13px] text-[var(--green)] hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((card) => (
            <ShardCard
              key={card.id}
              card={card}
              rep={repMap.get(card.node_id) ?? EMPTY_REP}
              selected={selected?.id === card.id}
              onClick={() => setSelected((prev) => (prev?.id === card.id ? null : card))}
            />
          ))}
        </div>
      )}

      {selected && (
        <ShardDrawer
          card={selected}
          rep={repMap.get(selected.node_id) ?? EMPTY_REP}
          loadedPools={loadedPools}
          onClose={() => setSelected(null)}
        />
      )}

      <p className="mt-6 font-mono text-[10px] text-[var(--text-faint)]">
        Live data: orchestrator · 0G Galileo · 0G Storage
      </p>
    </>
  );
}
