"use client";

import { useState } from "react";
import { ShardCard } from "./ShardCard";
import { ShardDrawer } from "./ShardDrawer";
import {
  SHARD_LISTINGS,
  sortShards,
  type LayerGroup,
  type ShardListing,
  type SortKey,
} from "@/lib/marketplace";

const LAYER_FILTERS: { label: string; value: LayerGroup | "all" }[] = [
  { label: "All",     value: "all"   },
  { label: "L 0–10",  value: "0-10"  },
  { label: "L 11–20", value: "11-20" },
  { label: "L 21–30", value: "21-30" },
  { label: "L 31+",   value: "31+"   },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "Reputation",  value: "rep-desc"  },
  { label: "Bid: Low",    value: "bid-asc"   },
  { label: "Bid: High",   value: "bid-desc"  },
  { label: "Layer",       value: "layer-asc" },
];

export function MarketplaceClient() {
  const [layerFilter, setLayerFilter] = useState<LayerGroup | "all">("all");
  const [sortKey, setSortKey]         = useState<SortKey>("rep-desc");
  const [selected, setSelected]       = useState<ShardListing | null>(null);
  const [sortOpen, setSortOpen]       = useState(false);

  const visible = sortShards(
    layerFilter === "all"
      ? SHARD_LISTINGS
      : SHARD_LISTINGS.filter((s) => s.layerGroup === layerFilter),
    sortKey,
  );

  const available   = SHARD_LISTINGS.filter((s) => s.status === "available").length;
  const inCoalition = SHARD_LISTINGS.filter((s) => s.status === "in-coalition").length;
  const executing   = SHARD_LISTINGS.filter((s) => s.status === "executing").length;

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
            Browse GPU shard iNFTs available for coalition
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

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="font-mono text-[11px] text-[var(--text-faint)] uppercase tracking-[0.08em]">
            No shards for this filter
          </span>
          <button
            onClick={() => setLayerFilter("all")}
            className="text-[13px] text-[var(--green)] hover:underline"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((shard) => (
            <ShardCard
              key={shard.id}
              shard={shard}
              selected={selected?.id === shard.id}
              onClick={() =>
                setSelected((prev) => (prev?.id === shard.id ? null : shard))
              }
            />
          ))}
        </div>
      )}

      {selected && (
        <ShardDrawer shard={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
