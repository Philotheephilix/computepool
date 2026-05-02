import type { InferResponse } from "@/lib/api";

export type StoredJob = InferResponse & {
  created_at: string;
  activationHash?: string;
  source?: "orchestrator" | "0g-compute";
};

const KEY = "cp_jobs";

export function saveJob(job: Omit<StoredJob, "created_at">): void {
  if (typeof window === "undefined") return;
  const all = loadJobs();
  const stored: StoredJob = { ...job, created_at: new Date().toISOString() };
  const updated = [stored, ...all.filter((j) => j.request_id !== job.request_id)].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(updated));
}

export function loadJobs(): StoredJob[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as StoredJob[];
  } catch {
    return [];
  }
}

export function loadJob(requestId: string): StoredJob | null {
  return loadJobs().find((j) => j.request_id === requestId) ?? null;
}

export function totalSpendUsdc(): number {
  return loadJobs().reduce((acc, j) => acc + (j.cost_usdc ?? 0), 0);
}
