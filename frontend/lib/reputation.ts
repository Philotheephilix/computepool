export type RepEntry = {
  won: boolean;
  sla_met: boolean;
  timestamp: string;
};

export type RepSummary = {
  winRate: number;
  winHistory: ("w" | "l")[];
  slaPct: number;
  count: number;
};

export type RepReceipt = {
  txHash: string;
  uploadedAt: string;
};

const histKey    = (nodeId: string) => `cp_rep_${nodeId}`;
const receiptKey = (nodeId: string) => `cp_rep_tx_${nodeId}`;

function readHistory(nodeId: string): RepEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(histKey(nodeId)) ?? "[]") as RepEntry[];
  } catch {
    return [];
  }
}

function writeHistory(nodeId: string, history: RepEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(histKey(nodeId), JSON.stringify(history));
  } catch {
    // quota or privacy mode — ignore
  }
}

export function saveReputation(nodeId: string, entry: RepEntry): void {
  if (typeof window === "undefined") return;
  const history = readHistory(nodeId);
  const updated = [entry, ...history].slice(0, 100);
  writeHistory(nodeId, updated);
  // Mirror to 0G Storage in the background. Never blocks inference.
  void persistToOGStorage(nodeId, updated);
}

async function persistToOGStorage(nodeId: string, history: RepEntry[]): Promise<void> {
  try {
    const { getEthersSigner } = await import("@/lib/0g-compute");
    const signer = await getEthersSigner();
    if (!signer) return; // no wallet connected — best-effort skip

    const { uploadJsonToStorage } = await import("@/lib/0g-storage");
    const result = await uploadJsonToStorage(
      { kind: "cp:reputation", nodeId, history, savedAt: new Date().toISOString() },
      signer,
    );
    if (!result.ok) return;

    try {
      const receipt: RepReceipt = {
        txHash: result.txHash,
        uploadedAt: new Date().toISOString(),
      };
      localStorage.setItem(receiptKey(nodeId), JSON.stringify(receipt));
    } catch {
      // ignore localStorage write errors
    }
  } catch {
    // best-effort: swallow errors so inference flow is never blocked
  }
}

export function getReputation(nodeId: string): RepSummary {
  const history = readHistory(nodeId);
  const count = history.length;
  if (count === 0) return { winRate: 0, winHistory: [], slaPct: 0, count: 0 };
  const wins = history.filter((e) => e.won).length;
  const slas = history.filter((e) => e.sla_met).length;
  const winHistory: ("w" | "l")[] = history.slice(0, 12).map((e) => (e.won ? "w" : "l"));
  return {
    winRate: (wins / count) * 100,
    winHistory,
    slaPct: (slas / count) * 100,
    count,
  };
}

export function getReputationReceipt(nodeId: string): RepReceipt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(receiptKey(nodeId));
    if (!raw) return null;
    return JSON.parse(raw) as RepReceipt;
  } catch {
    return null;
  }
}

// Best-effort hydration from 0G Storage when local cache is empty.
// Never throws; returns the loaded history (also written to localStorage) or null.
export async function loadFromStorage(nodeId: string): Promise<RepEntry[] | null> {
  if (typeof window === "undefined") return null;

  if (readHistory(nodeId).length > 0) return readHistory(nodeId);

  const receipt = getReputationReceipt(nodeId);
  if (!receipt?.txHash) return null;

  try {
    const { downloadJsonFromStorage } = await import("@/lib/0g-storage");
    const blob = await downloadJsonFromStorage(receipt.txHash);
    if (!blob || typeof blob !== "object") return null;
    const history = (blob as { history?: unknown }).history;
    if (!Array.isArray(history)) return null;
    const valid = history.filter(
      (e): e is RepEntry =>
        !!e && typeof e === "object"
        && typeof (e as RepEntry).won === "boolean"
        && typeof (e as RepEntry).sla_met === "boolean"
        && typeof (e as RepEntry).timestamp === "string",
    );
    if (valid.length === 0) return null;
    writeHistory(nodeId, valid);
    return valid;
  } catch {
    return null;
  }
}
