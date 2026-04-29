"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M5 4h9M5 8h9M5 12h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="2" cy="4" r="1" fill="currentColor" />
      <circle cx="2" cy="8" r="1" fill="currentColor" />
      <circle cx="2" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="5" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5V3.5A1.5 1.5 0 0 1 6.5 2h3A1.5 1.5 0 0 1 11 3.5V5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11.5" cy="9.5" r="1" fill="currentColor" />
    </svg>
  );
}

const NAV = [
  { href: "/marketplace", label: "Marketplace", icon: <GridIcon /> },
  { href: "/jobs/new", label: "Post Job", icon: <PlusIcon /> },
  { href: "/jobs", label: "My Jobs", icon: <ListIcon /> },
  { href: "/wallet", label: "My Wallet", icon: <WalletIcon /> },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 left-0 h-screen w-[200px] flex flex-col border-r border-[var(--border)] bg-[var(--bg-panel)]"
      style={{ zIndex: 50 }}
    >
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <Link href="/" className="block">
          <span
            className="text-[16px] text-[var(--text)] block"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            ComputePool
          </span>
          <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.15em] mt-0.5 block">
            v2 · OpenAgents
          </span>
        </Link>
      </div>

      <div className="flex flex-col gap-0.5 p-3 flex-1">
        {NAV.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" &&
              item.href !== "/jobs/new" &&
              pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-[12px] transition-colors ${
                isActive
                  ? "bg-[var(--bg-elev)] text-[var(--green)] border border-[var(--border-soft)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-elev)]"
              }`}
            >
              <span className={isActive ? "text-[var(--green)]" : "text-[var(--text-faint)]"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-[var(--border)]">
        <Link
          href="/connect"
          className="flex items-center gap-2 text-[10px] hover:opacity-80 transition-opacity"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--green)] shrink-0"
            style={{ animation: "pulse 2s infinite" }}
          />
          <span className="text-[var(--text-muted)] truncate">0x1f2a…a01</span>
        </Link>
        <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.1em] mt-0.5 block">
          AXL mesh · 8 peers
        </span>
      </div>
    </nav>
  );
}
