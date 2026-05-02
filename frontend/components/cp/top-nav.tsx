"use client";

import * as React from "react";
import Link from "next/link";
import { useT, FONT_BODY, FONT_MONO } from "./theme";
import { Logo } from "./logo";
import { Badge, Button } from "./primitives";

export function TopNav({ active }: { active: "landing" | "dashboard" | "infer" }) {
  const T = useT();
  const items = [
    { id: "landing",   label: "Home",          path: "/" },
    { id: "dashboard", label: "Dashboard",     path: "/dashboard" },
    { id: "infer",     label: "Run inference", path: "/infer" },
  ] as const;
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      background: `${T.bg}E6`, backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${T.border}`,
      padding: "18px 64px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <Link href="/" style={{ cursor: "pointer", textDecoration: "none" }}>
        <Logo size={26}/>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {items.map((i) => (
          <Link key={i.id} href={i.path} style={{
            padding: "8px 16px", borderRadius: 8, cursor: "pointer",
            fontFamily: FONT_BODY, fontSize: 14, fontWeight: 500,
            color: active === i.id ? T.text1 : T.text2,
            background: active === i.id ? T.surfaceWarm : "transparent",
            whiteSpace: "nowrap", textDecoration: "none",
          }}>{i.label}</Link>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Badge kind="primary" label="0G Galileo · live"/>
        <Link href="/connect" style={{ textDecoration: "none" }}>
          <Button kind="secondary" style={{ whiteSpace: "nowrap" }}>0x7a4f…c19e</Button>
        </Link>
      </div>
    </nav>
  );
}

export function Footer() {
  const T = useT();
  return (
    <footer style={{
      borderTop: `1px solid ${T.border}`,
      padding: "40px 64px",
      maxWidth: 1440, margin: "0 auto",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <Logo size={22}/>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.text3 }}>
        © 2026 ComputePool · 0G Galileo · v0.4.2
      </div>
    </footer>
  );
}
