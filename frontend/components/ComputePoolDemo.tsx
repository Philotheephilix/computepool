"use client";

import { Header } from "@/components/header/Header";
import { PhaseTimeline } from "@/components/timeline/PhaseTimeline";
import { AXLMesh } from "@/components/mesh/AXLMesh";
import { AuctionArena } from "@/components/auction/AuctionArena";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { INFTWallet } from "@/components/wallet/INFTWallet";
import { useDemoLoop } from "@/hooks/useDemoLoop";

export function ComputePoolDemo() {
  const demo = useDemoLoop();

  return (
    <div className="w-full px-6 pb-[60px] pt-8 sm:px-8 md:px-10 lg:px-12 xl:px-16">
      <Header playing={demo.playing} onPlay={demo.play} onReset={demo.reset} />

      <PhaseTimeline activeStep={demo.timelineStep} />

      <AXLMesh
        nodeStates={demo.meshNodeStates}
        linkStates={demo.meshLinkStates}
        activeChannels={demo.activeChannels}
        jobsInFlight={demo.jobsInFlight}
      />

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.1fr_1.4fr]">
        <AuctionArena job={demo.job} rows={demo.auctionRows} leading={demo.leading} />
        <PipelineView
          tps={demo.tps}
          curLayer={demo.curLayer}
          tokenCount={demo.tokenCount}
          payoutEth={demo.payoutEth}
          hashCount={demo.hashCount}
          shardStates={demo.pipeShardStates}
          slashVisible={demo.slashVisible}
          particles={demo.particles}
        />
      </div>

      <INFTWallet
        royaltyEth={demo.royaltyEth}
        repWinPct={demo.repWinPct}
        repSlaPct={demo.repSlaPct}
        repWinWarn={demo.repWinWarn}
        repHistory={demo.repHistory}
      />

      <div className="mt-8 text-center">
        <span
          className="text-[14px] italic text-[var(--text-muted)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          — frontend reference for ComputePool · OpenAgents 2026 —
        </span>
      </div>
    </div>
  );
}
