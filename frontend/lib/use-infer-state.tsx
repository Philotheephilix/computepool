"use client";

import * as React from "react";
import type { PaymentRequirements } from "./sign-payment";

export type InferMode = "demo" | "live";

export type InferState = {
  mode: InferMode;
  /** Real pool name (live mode) or canned label (demo mode). */
  poolName: string;
  /** Pool's model name, e.g. "Qwen/Qwen2.5-3B-Instruct". */
  model: string;
  /** Display label, e.g. "Qwen3-4B-Instruct". */
  modelName: string;
  /** Per-token price in USDC (from pool config; 0 in demo). */
  pricePerTokenUsdc: number;
  /** Free-form user prompt. */
  prompt: string;
  /** Up-front budget in USDCx (UI knob). */
  budget: number;
  /** Cap on max_tokens for live runs. */
  maxTokens: number;

  // populated by /infer/review once the user signs the x402 payment
  xPayment?: string | null;
  payer?: string | null;
  requirements?: PaymentRequirements | null;

  // populated by /infer/active as the SSE stream completes
  output?: string;
  breached?: boolean;
  durationMs?: number;
  tokens?: number;
  costUsdc?: number;
  settleTx?: string;
  errorMsg?: string;

  /** Pool worker assignments: [{node_id, role, layers:[start,end]}, …] — used by the receipt to label per-node payouts. */
  assignments?: { node_id: string; role: "entry" | "exit"; layers: [number, number] }[] | null;
};

const DEFAULTS: InferState = {
  mode: "demo",
  poolName: "qwen-pool-1",
  model: "Qwen/Qwen2.5-3B-Instruct",
  modelName: "Qwen3-4B-Instruct",
  pricePerTokenUsdc: 0.0001,
  prompt: "Explain how attention works in transformers, simply.",
  budget: 0.5,
  maxTokens: 20,
};

const InferCtx = React.createContext<{
  state: InferState;
  setState: React.Dispatch<React.SetStateAction<InferState>>;
} | null>(null);

export function InferProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<InferState>(DEFAULTS);
  const value = React.useMemo(() => ({ state, setState }), [state]);
  return <InferCtx.Provider value={value}>{children}</InferCtx.Provider>;
}

export function useInferState() {
  const v = React.useContext(InferCtx);
  if (!v) throw new Error("useInferState must be used inside <InferProvider>");
  return v;
}
