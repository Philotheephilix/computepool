import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

export const SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC),
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
