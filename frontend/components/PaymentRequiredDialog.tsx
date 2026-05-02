"use client";

import { useState } from "react";

interface Requirements {
  scheme: "exact";
  network: "0g-galileo";
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: `0x${string}`;
  asset: `0x${string}`;
  extra?: { name: string; version: string };
}

interface Props {
  requirements: Requirements;
  onSigned: (xPaymentHeader: string) => void;
  onCancel: () => void;
}

export function PaymentRequiredDialog({ requirements, onSigned, onCancel }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pay() {
    setBusy(true); setErr(null);
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("no wallet detected");
      const [from] = await eth.request({ method: "eth_requestAccounts" });

      const validAfter = "0";
      const validBefore = String(Math.floor(Date.now() / 1000) + 600);
      const nonce = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0")).join("");

      const typed = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        domain: {
          name: requirements.extra?.name ?? "USDC",
          version: requirements.extra?.version ?? "2",
          chainId: 16602,
          verifyingContract: requirements.asset,
        },
        primaryType: "TransferWithAuthorization",
        message: {
          from, to: requirements.payTo,
          value: requirements.maxAmountRequired,
          validAfter, validBefore, nonce,
        },
      };

      const signature = await eth.request({
        method: "eth_signTypedData_v4",
        params: [from, JSON.stringify(typed)],
      });

      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: "0g-galileo",
        payload: {
          signature,
          authorization: typed.message,
        },
      };
      const header = btoa(JSON.stringify(payload));
      onSigned(header);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const human = (Number(requirements.maxAmountRequired) / 1e6).toFixed(4);

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50">
      <div className="bg-background rounded p-6 max-w-md w-full">
        <h2 className="text-lg font-semibold">Payment Required</h2>
        <p className="text-sm text-muted-foreground mt-1">{requirements.description}</p>
        <div className="my-4 space-y-1 text-sm">
          <div>Amount: <span className="font-mono">{human} USDC</span></div>
          <div>Pay to: <span className="font-mono text-xs">{requirements.payTo}</span></div>
          <div>Network: 0G-Galileo Testnet</div>
        </div>
        {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
        <div className="flex gap-2 justify-end">
          <button className="px-3 py-1 border rounded" onClick={onCancel}>Cancel</button>
          <button className="px-3 py-1 bg-primary text-primary-foreground rounded"
                  disabled={busy} onClick={pay}>
            {busy ? "Signing…" : "Sign and pay"}
          </button>
        </div>
      </div>
    </div>
  );
}
