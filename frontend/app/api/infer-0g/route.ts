export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";

const PRIVATE_KEY = process.env.PRIVATE_KEY_0G;
const RPC_URL = "https://evmrpc-testnet.0g.ai";

export async function POST(req: NextRequest) {
  if (!PRIVATE_KEY) {
    return NextResponse.json({ error: "PRIVATE_KEY_0G not configured" }, { status: 503 });
  }

  let body: { prompt?: string; max_tokens?: number; temperature?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, max_tokens = 128, temperature = 0.7 } = body;
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const broker = await createZGComputeNetworkBroker(wallet);

    const services = await broker.inference.listService();
    if (services.length === 0) {
      return NextResponse.json({ error: "No 0G Compute services available on this network" }, { status: 503 });
    }

    const service = services[0];
    const providerAddr: string = service.provider;

    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddr);
    const headers = await broker.inference.getRequestHeaders(providerAddr, prompt);

    const start = Date.now();
    const resp = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(headers as unknown as Record<string, string>),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens,
        temperature,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      return NextResponse.json({ error: `Provider error ${resp.status}: ${errText}` }, { status: 502 });
    }

    const data = await resp.json();
    const elapsed_s = (Date.now() - start) / 1000;
    const text: string | null = data.choices?.[0]?.message?.content ?? null;
    const tokens: number | null = data.usage?.completion_tokens ?? null;

    return NextResponse.json({
      text,
      tokens,
      elapsed_s,
      tokens_per_sec: tokens != null && elapsed_s > 0 ? tokens / elapsed_s : null,
      cost_usdc: 0,
      currency: "USDC",
      pool: `0g:${providerAddr.slice(0, 8)}…`,
      entry_node: providerAddr,
      exit_node: providerAddr,
      request_id: `0g-${Date.now()}`,
      timings: null,
      source: "0g-compute",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
