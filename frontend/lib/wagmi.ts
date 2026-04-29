import { createConfig, http, injected } from "wagmi";
import { defineChain } from "viem";

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
  chains: [galileo, ogMainnet],
  connectors: [injected()],
  transports: {
    [galileo.id]: http(),
    [ogMainnet.id]: http(),
  },
});
