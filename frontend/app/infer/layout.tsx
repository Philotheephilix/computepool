"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/components/cp/theme";
import { TopNav } from "@/components/cp/top-nav";
import { StepStrip } from "@/components/cp/step-strip";
import { useBreakpoint } from "@/lib/use-breakpoint";

const IDX: Record<string, number> = {
  "/infer": 0,
  "/infer/setup": 1,
  "/infer/review": 2,
  "/infer/active": 3,
  "/infer/result": 4,
};

export default function InferLayout({ children }: { children: React.ReactNode }) {
  const T = useT();
  const isMobile = useBreakpoint();
  const path = usePathname() ?? "/infer";
  const idx = IDX[path] ?? 0;
  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <TopNav active="infer"/>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "24px 16px 48px" : "40px 48px 80px" }}>
        <StepStrip idx={idx}/>
        <div style={{ marginTop: isMobile ? 28 : 48 }}>{children}</div>
      </div>
    </div>
  );
}
