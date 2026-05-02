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

// Best-effort download. Tries common SDK method names; returns parsed JSON or null.
export async function downloadJsonFromStorage(
  merkleRoot: string,
): Promise<unknown | null> {
  if (!merkleRoot) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdk = (await import("@0gfoundation/0g-storage-ts-sdk")) as any;
    const Indexer = sdk.Indexer;
    if (!Indexer) return null;
    const indexer = new Indexer(OG_INDEXER);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx = indexer as any;

    const tryCalls: Array<() => Promise<unknown>> = [
      () => idx.download?.(merkleRoot, false),
      () => idx.download?.(merkleRoot),
      () => idx.downloadFile?.(merkleRoot),
      () => idx.fetch?.(merkleRoot),
    ];
    let buf: unknown = null;
    for (const fn of tryCalls) {
      try {
        const r = await fn();
        if (r) {
          buf = r;
          break;
        }
      } catch {
        // try next
      }
    }
    if (!buf) return null;

    let text: string;
    if (typeof buf === "string") {
      text = buf;
    } else if (buf instanceof Uint8Array) {
      text = new TextDecoder().decode(buf);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if ((buf as any)?.buffer instanceof ArrayBuffer) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      text = new TextDecoder().decode(new Uint8Array((buf as any).buffer));
    } else {
      text = String(buf);
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
}
