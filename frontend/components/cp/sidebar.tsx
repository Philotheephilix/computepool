"use client";

import * as React from "react";
import Link from "next/link";
import { useT, FONT_BODY, FONT_MONO } from "./theme";
import { Logo } from "./logo";
import { Badge } from "./primitives";

type Item = { id: string; label: string; icon: string; path: string };

const ITEMS: Item[] = [
  { id: "/",         label: "Overview",  icon: "◇", path: "/dashboard" },
  { id: "/pools",    label: "Pools",     icon: "⬡", path: "/dashboard/pools" },
  { id: "/nodes",    label: "Nodes",     icon: "●", path: "/dashboard/nodes" },
  { id: "/jobs",     label: "Jobs",      icon: "▤", path: "/dashboard/jobs" },
  { id: "/payments", label: "Payments",  icon: "⤳", path: "/dashboard/payments" },
];

export function Sidebar({ active }: { active: string }) {
  const T = useT();
  return (
    <aside style={{
      width: 240, background: T.surface, borderRight: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0,
      position: "sticky", top: 0, height: "100vh",
    }}>
      <div style={{ padding: "0 20px 24px" }}>
        <Link href="/" style={{ cursor: "pointer", textDecoration: "none" }}><Logo size={22}/></Link>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
        {ITEMS.map((it) => {
          const on = active === it.id;
          return (
            <Link key={it.id} href={it.path} style={{
              display: "flex", alignItems: "center", gap: 12,
              height: 40, padding: "0 12px",
              fontFamily: FONT_BODY, fontSize: 14, fontWeight: 500,
              color: on ? T.primary : T.text2,
              background: on ? T.primaryLight : "transparent",
              borderLeft: on ? `3px solid ${T.primary}` : "3px solid transparent",
              cursor: "pointer", borderRadius: 0, textDecoration: "none",
            }}>
              <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ flex: 1 }}/>
      <div style={{ padding: "16px 20px", borderTop: `1px solid ${T.border}` }}>
        <Badge kind="primary" label="0G Galileo · live" style={{ marginBottom: 10 }}/>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text2 }}>0x7a4f…c19e</div>
        <Link href="/connect" style={{ textDecoration: "none" }}>
          <div style={{ marginTop: 8, fontFamily: FONT_BODY, fontSize: 12, color: T.text3, cursor: "pointer" }}>Disconnect</div>
        </Link>
      </div>
    </aside>
  );
}
