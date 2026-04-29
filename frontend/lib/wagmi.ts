import { createConfig, http, injected } from "wagmi";
import { defineChain } from "viem";

// 0G Galileo testnet ships with two chain ids in the wild:
//   16602  — official 0G docs / chainscan
//   16601  — viem's bundled `0gGalileoTestnet` and most chainlist.org entries
// Both point at the same network (https://evmrpc-testnet.0g.ai), so we
// accept either as a "valid" Galileo chain id throughout the app.
export const GALILEO_CHAIN_IDS = [16602, 16601] as const;
export type GalileoChainId = (typeof GALILEO_CHAIN_IDS)[number];

export function isGalileoChain(chainId: number | undefined): boolean {
  return chainId != null && (GALILEO_CHAIN_IDS as readonly number[]).includes(chainId);
}

export const galileo = defineChain({
  id: 16602,
  name: "0G Galileo",
  nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Scan", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
});

export const galileoAlt = defineChain({
  id: 16601,
  name: "0G Galileo",
  nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Scan", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
});

export const ogMainnet = defineChain({
  id: 16661,
  name: "0G",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Scan", url: "https://chainscan.0g.ai" },
  },
});

export const wagmiConfig = createConfig({
  chains: [galileo, galileoAlt, ogMainnet],
  connectors: [injected()],
  transports: {
    [galileo.id]: http(),
    [galileoAlt.id]: http(),
    [ogMainnet.id]: http(),
  },
});
