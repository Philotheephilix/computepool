"use client";

import * as React from "react";
import Link from "next/link";
import { useT, FONT_BODY } from "./theme";

const STEPS = [
  { label: "Model",  path: "/infer" },
  { label: "Setup",  path: "/infer/setup" },
  { label: "Review", path: "/infer/review" },
  { label: "Run",    path: "/infer/active" },
  { label: "Result", path: "/infer/result" },
];

export function StepStrip({ idx }: { idx: number }) {
  const T = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {STEPS.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        const pill = (
          <span style={{
            padding: "7px 14px", borderRadius: 999, cursor: done ? "pointer" : "default",
            background: active ? T.primary : (done ? T.primaryLight : T.surface),
            color: active ? "#fff" : (done ? T.primary : T.text3),
            border: `1px solid ${active ? T.primary : (done ? T.primaryLight : T.border)}`,
            fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500,
            whiteSpace: "nowrap",
          }}>{done ? "✓ " : ""}{s.label}</span>
        );
        return (
          <React.Fragment key={s.label}>
            {done ? (
              <Link href={s.path} style={{ textDecoration: "none" }}>{pill}</Link>
            ) : pill}
            {i < STEPS.length - 1 && <div style={{ width: 24, height: 1, background: T.border }}/>}
          </React.Fragment>
        );
      })}
    </div>
  );
}
