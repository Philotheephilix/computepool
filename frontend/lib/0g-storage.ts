export const OG_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai";
export const OG_RPC = "https://evmrpc-testnet.0g.ai";

export type UploadResult =
  | { ok: true; txHash: string }
  | { ok: false; error: string };

export async function uploadJsonToStorage(
  data: unknown,
  signer: unknown
): Promise<UploadResult> {
  try {
    const { MemData, Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file = new MemData(Buffer.from(bytes) as any);
    const indexer = new Indexer(OG_INDEXER);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [tx, err] = await (indexer as any).upload(file, OG_RPC, signer);
    if (err) return { ok: false, error: String(err) };
    return { ok: true, txHash: String(tx) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
