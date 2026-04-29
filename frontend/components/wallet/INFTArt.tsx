"use client";

export function INFTArt() {
  return (
    <div className="h-[160px] w-[160px] overflow-hidden border border-[var(--border-soft)] bg-[var(--bg-elev)]">
      <svg viewBox="0 0 160 160" className="h-full w-full">
        <defs>
          <linearGradient id="inft-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#16161a" />
            <stop offset="100%" stopColor="#0a0a0b" />
          </linearGradient>
          <pattern
            id="inft-circuit"
            x="0"
            y="0"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 7 H14 M7 0 V14" stroke="#1f1f24" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="160" height="160" fill="url(#inft-grad)" />
        <rect width="160" height="160" fill="url(#inft-circuit)" />
        <rect
          x="34"
          y="34"
          width="92"
          height="92"
          fill="#0a0a0b"
          stroke="var(--green)"
          strokeWidth="1"
        />
        <rect
          x="44"
          y="44"
          width="72"
          height="72"
          fill="none"
          stroke="var(--green)"
          strokeWidth="0.5"
          opacity="0.4"
        />
        <text
          x="80"
          y="76"
          textAnchor="middle"
          fill="var(--green)"
          fontSize="9"
          fontWeight="500"
          letterSpacing="1.5"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          SHARD
        </text>
        <text
          x="80"
          y="92"
          textAnchor="middle"
          fill="var(--text)"
          fontSize="22"
          fontStyle="italic"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          07
        </text>
        <g stroke="var(--green)" strokeWidth="1">
          <line x1="34" y1="50" x2="20" y2="50" />
          <line x1="34" y1="70" x2="20" y2="70" />
          <line x1="34" y1="90" x2="20" y2="90" />
          <line x1="34" y1="110" x2="20" y2="110" />
          <line x1="126" y1="50" x2="140" y2="50" />
          <line x1="126" y1="70" x2="140" y2="70" />
          <line x1="126" y1="90" x2="140" y2="90" />
          <line x1="126" y1="110" x2="140" y2="110" />
        </g>
      </svg>
    </div>
  );
}
