"use client";

interface Tx {
  label: string;          // "coalition.propose"
  hash: `0x${string}`;
  status: "pending" | "ok" | "failed";
  timestamp: number;
}

export function TxTrail({ items }: { items: Tx[] }) {
  return (
    <ol className="space-y-1 text-sm">
      {items.map((t, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className={
            t.status === "ok" ? "text-green-600"
            : t.status === "failed" ? "text-red-600"
            : "text-muted-foreground"
          }>●</span>
          <span className="font-medium">{t.label}</span>
          <a className="font-mono text-xs underline"
             href={`https://chainscan-galileo.0g.ai/tx/${t.hash}`}
             target="_blank" rel="noreferrer">
            {t.hash.slice(0, 10)}…
          </a>
        </li>
      ))}
    </ol>
  );
}
