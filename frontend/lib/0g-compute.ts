export async function getEthersSigner(): Promise<unknown | null> {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(window as any).ethereum) return null;
  try {
    const { BrowserProvider } = await import("ethers");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = new BrowserProvider((window as any).ethereum);
    return await provider.getSigner();
  } catch {
    return null;
  }
}
