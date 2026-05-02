export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export const BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_ORCHESTRATOR_URL
    ? process.env.NEXT_PUBLIC_ORCHESTRATOR_URL
    : "http://localhost:8000";

function apiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cp_api_key");
}

function h(auth = true): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const k = apiKey();
    if (k) headers["X-API-Key"] = k;
  }
  return headers;
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    let msg = res.statusText;
    let parsed: unknown = undefined;
    try {
      const body = await res.json();
      parsed = body;
      const d = body.detail ?? body.error ?? body;
      msg = typeof d === "string" ? d : JSON.stringify(d);
    } catch { /* ignore parse error */ }
    throw new ApiError(res.status, msg, parsed);
  }
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type AuthResponse = { username: string; api_key: string };

export type Pool = {
  name: string;
  owner_username: string;
  node_ids: string[];
  model: string | null;
  price_per_token_usdc: number | null;
  currency: "USDC";
  initialized: boolean;
  loaded: boolean;
  assignments: { node_id: string; role: "entry" | "exit"; layers: [number, number] }[] | null;
  created_at: string | null;
  updated_at: string | null;
  inft_token_id: number | null;
  inft_metadata_uri: string | null;
};

export type Node = {
  node_id: string;
  owner_username: string;
  ip_address: string | null;
  axl_peer_id: string | null;
  axl_ipv6: string | null;
  worker_url: string | null;
  pool_name: string | null;
  registered_at: string | null;
  last_seen: string | null;
  status: "registered" | "configured" | "loaded" | "unhealthy";
  role: "entry" | "exit" | null;
  layers: [number, number] | null;
  model: string | null;
};

export type InferResponse = {
  text: string | null;
  tokens: number | null;
  elapsed_s: number | null;
  tokens_per_sec: number | null;
  cost_usdc: number;
  currency: "USDC";
  pool: string;
  entry_node: string;
  exit_node: string;
  request_id: string;
  timings: Record<string, unknown> | null;
};

export type ApiState = {
  user: { username: string };
  nodes: Node[];
  pools: Pool[];
  models: Record<string, number>;
};

// ── Auth ──────────────────────────────────────────────────────────────────

export const auth = {
  register: (username: string, password: string) =>
    req<AuthResponse>("/auth/register", {
      method: "POST",
      headers: h(false),
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    req<AuthResponse>("/auth/login", {
      method: "POST",
      headers: h(false),
      body: JSON.stringify({ username, password }),
    }),
  me: () => req<{ username: string }>("/auth/me", { headers: h() }),
};

// ── Nodes ─────────────────────────────────────────────────────────────────

export const nodes = {
  list: () => req<Node[]>("/nodes", { headers: h() }),
  delete: (nodeId: string) =>
    req<{ ok: boolean }>(`/nodes/${nodeId}`, { method: "DELETE", headers: h() }),
};

// ── Pools ─────────────────────────────────────────────────────────────────

export const pools = {
  list: () => req<Pool[]>("/pools", { headers: h() }),
  create: (name: string) =>
    req<Pool>("/pools", {
      method: "POST",
      headers: h(),
      body: JSON.stringify({ name }),
    }),
  delete: (name: string) =>
    req<{ ok: boolean }>(`/pools/${name}`, { method: "DELETE", headers: h() }),
  addNodes: (name: string, nodeIds: string[]) =>
    req<Pool>(`/pools/${name}/nodes`, {
      method: "POST",
      headers: h(),
      body: JSON.stringify({ node_ids: nodeIds }),
    }),
  removeNode: (name: string, nodeId: string) =>
    req<Pool>(`/pools/${name}/nodes/${nodeId}`, { method: "DELETE", headers: h() }),
  initialize: (name: string, model: string, pricePerTokenUsdc: number) =>
    req<Pool>(`/pools/${name}/initialize`, {
      method: "POST",
      headers: h(),
      body: JSON.stringify({ model, price_per_token_usdc: pricePerTokenUsdc, currency: "USDC" }),
    }),
  load: (name: string) =>
    req<unknown>(`/pools/${name}/load`, { method: "POST", headers: h() }),
  unload: (name: string) =>
    req<unknown>(`/pools/${name}/unload`, { method: "POST", headers: h() }),
  infer: (
    name: string,
    prompt: string,
    maxTokens: number,
    temperature: number,
    extraHeaders: Record<string, string> = {},
  ) =>
    req<InferResponse>(`/pools/${name}/infer`, {
      method: "POST",
      headers: { ...(h() as Record<string, string>), ...extraHeaders },
      body: JSON.stringify({ prompt, max_tokens: maxTokens, temperature }),
    }),
};

// ── State ─────────────────────────────────────────────────────────────────

export const state = {
  get: () => req<ApiState>("/api/state", { headers: h() }),
};

export const models = {
  list: () => req<Record<string, number>>("/api/models", { headers: h(false) }),
};
