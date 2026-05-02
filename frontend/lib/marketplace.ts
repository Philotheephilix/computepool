import type { Node } from "@/lib/api";

export type ShardStatus = "available" | "in-coalition" | "executing" | "slashed";
export type LayerGroup = "0-10" | "11-20" | "21-30" | "31+";
export type SortKey = "status" | "layer-asc" | "last-seen";

export type NodeCard = {
  id: string;
  node_id: string;
  axl_peer_id: string | null;
  axl_ipv6: string | null;
  layers: [number, number] | null;
  layerGroup: LayerGroup;
  status: ShardStatus;
  model: string | null;
  pool_name: string | null;
  last_seen: string | null;
  role: "entry" | "exit" | null;
  num: string;
};

export function nodeToLayerGroup(layers: [number, number] | null): LayerGroup {
  if (!layers) return "0-10";
  const [start] = layers;
  if (start <= 10) return "0-10";
  if (start <= 20) return "11-20";
  if (start <= 30) return "21-30";
  return "31+";
}

export function nodeToStatus(status: string, poolName: string | null): ShardStatus {
  if (status === "unhealthy") return "slashed";
  if (status === "loaded") return "executing";
  if (status === "configured" && poolName) return "in-coalition";
  return "available";
}

export function nodeToNum(nodeId: string): string {
  const clean = nodeId.replace(/-/g, "");
  return clean.slice(-4, -2).toUpperCase() || clean.slice(0, 2).toUpperCase() || "??";
}

export function nodeToCard(node: Node): NodeCard {
  return {
    id: node.node_id,
    node_id: node.node_id,
    axl_peer_id: node.axl_peer_id,
    axl_ipv6: node.axl_ipv6,
    layers: node.layers,
    layerGroup: nodeToLayerGroup(node.layers),
    status: nodeToStatus(node.status, node.pool_name),
    model: node.model,
    pool_name: node.pool_name,
    last_seen: node.last_seen,
    role: node.role,
    num: nodeToNum(node.node_id),
  };
}

export function sortCards(cards: NodeCard[], key: SortKey): NodeCard[] {
  return [...cards].sort((a, b) => {
    if (key === "layer-asc") return a.layerGroup.localeCompare(b.layerGroup);
    if (key === "last-seen") {
      const ta = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const tb = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      return tb - ta;
    }
    const order: Record<ShardStatus, number> = { available: 0, "in-coalition": 1, executing: 2, slashed: 3 };
    return order[a.status] - order[b.status];
  });
}

export const LAYER_GROUP_COLOR: Record<LayerGroup, string> = {
  "0-10":  "#5ec8ff",
  "11-20": "#ffb300",
  "21-30": "#00ff9c",
  "31+":   "#b39dff",
};

export const STATUS_LABEL: Record<ShardStatus, string> = {
  "available":    "available",
  "in-coalition": "in coalition",
  "executing":    "executing",
  "slashed":      "slashed",
};

export const STATUS_COLOR: Record<ShardStatus, string> = {
  "available":    "#00ff9c",
  "in-coalition": "#b39dff",
  "executing":    "#5ec8ff",
  "slashed":      "#ff4f6e",
};
