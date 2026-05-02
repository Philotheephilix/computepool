import { createPublicClient, defineChain, http } from "viem";

export const ZEROG_GALILEO_RPC =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  "https://evmrpc-testnet.0g.ai";

export const zeroGGalileo = defineChain({
  id: 16602,
  name: "0G-Galileo-Testnet",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: [ZEROG_GALILEO_RPC] } },
  blockExplorers: {
    default: { name: "0G Chainscan", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
});

export const SEPOLIA_RPC = ZEROG_GALILEO_RPC;

export const publicClient = createPublicClient({
  chain: zeroGGalileo,
  transport: http(ZEROG_GALILEO_RPC),
});

export const SUPER_TOKEN_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export async function readSuperTokenBalance(token: `0x${string}`, addr: `0x${string}`) {
  return publicClient.readContract({
    address: token,
    abi: SUPER_TOKEN_ABI,
    functionName: "balanceOf",
    args: [addr],
  });
}
