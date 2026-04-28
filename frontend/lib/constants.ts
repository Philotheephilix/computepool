export type MeshNodeState =
  | "idle"
  | "bidding"
  | "coalition"
  | "executing"
  | "slashed"
  | "done";

export type MeshLinkState = "inactive" | "active" | "coalition";

export type MeshNodeDef = {
  id: string;
  x: number;
  y: number;
  role: string;
  tokenId: string;
  axlPeerId: string;
  reputation: number;
};

export type MeshLinkDef = { a: number; b: number };

export const MESH_NODE_COLORS: Record<
  MeshNodeState,
  { fill: string; stroke: string; r: number }
> = {
  idle: { fill: "#16161a", stroke: "#44444c", r: 8 },
  bidding: { fill: "#3a2a00", stroke: "#ffb300", r: 8 },
  coalition: { fill: "#2a1f4a", stroke: "#b39dff", r: 8 },
  executing: { fill: "#0a3a4a", stroke: "#5ec8ff", r: 9 },
  slashed: { fill: "#3a0a14", stroke: "#ff4f6e", r: 8 },
  done: { fill: "#0a3322", stroke: "#00ff9c", r: 8 },
};

export const DEFAULT_MESH_NODES: MeshNodeDef[] = [
  {
    id: "shard-1",
    x: 80,
    y: 100,
    role: "L 0–10",
    tokenId: "0xA73f…0101 · #01",
    axlPeerId: "axl:peer:1f2a…a01",
    reputation: 92,
  },
  {
    id: "shard-2",
    x: 220,
    y: 50,
    role: "L 0–10",
    tokenId: "0xA73f…0202 · #02",
    axlPeerId: "axl:peer:9c11…b77",
    reputation: 89,
  },
  {
    id: "shard-3",
    x: 360,
    y: 130,
    role: "L 11–20",
    tokenId: "0xA73f…0303 · #03",
    axlPeerId: "axl:peer:2d88…19c",
    reputation: 86,
  },
  {
    id: "shard-4",
    x: 500,
    y: 60,
    role: "L 11–20",
    tokenId: "0xA73f…0404 · #04",
    axlPeerId: "axl:peer:aa03…e21",
    reputation: 90,
  },
  {
    id: "shard-5",
    x: 640,
    y: 100,
    role: "L 21–30",
    tokenId: "0xA73f…0505 · #05",
    axlPeerId: "axl:peer:4b0a…4dd",
    reputation: 94,
  },
  {
    id: "shard-6",
    x: 780,
    y: 40,
    role: "L 21–30",
    tokenId: "0xA73f…0606 · #06",
    axlPeerId: "axl:peer:0f7c…991",
    reputation: 88,
  },
  {
    id: "shard-7",
    x: 920,
    y: 130,
    role: "L 21–30",
    tokenId: "0xA73f…891c · #07",
    axlPeerId: "axl:peer:7e12…0c3",
    reputation: 96,
  },
  {
    id: "shard-8",
    x: 1080,
    y: 90,
    role: "L 31–32",
    tokenId: "0xA73f…0808 · #08",
    axlPeerId: "axl:peer:0aa1…2fe",
    reputation: 91,
  },
];

export const DEFAULT_MESH_LINKS: MeshLinkDef[] = [
  { a: 0, b: 1 },
  { a: 0, b: 2 },
  { a: 1, b: 2 },
  { a: 1, b: 3 },
  { a: 2, b: 3 },
  { a: 2, b: 4 },
  { a: 3, b: 4 },
  { a: 3, b: 5 },
  { a: 4, b: 5 },
  { a: 4, b: 6 },
  { a: 5, b: 6 },
  { a: 5, b: 7 },
  { a: 6, b: 7 },
];

