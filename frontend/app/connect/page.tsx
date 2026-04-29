"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi";
import { auth, ApiError } from "@/lib/api";
import { saveAuth, loadAuth, clearAuth } from "@/lib/auth-store";

type Tab = "signin" | "register";

function SimPill() {
  return (
    <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-[0.1em] border border-[#ff9c0044] text-[#ff9c00] bg-[#ff9c000d]">
      simulated
    </span>
  );
}

function WalletSection() {
  const { address, isConnected, chain } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.1em]">Wallet</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00ff9c1a] text-[var(--green)] border border-[#00ff9c44] uppercase tracking-[0.1em]">
            connected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--green)] shrink-0" style={{ animation: "pulse 2s infinite" }} />
          <span className="text-[12px] text-[var(--text)] font-mono truncate">
            {address.slice(0, 8)}…{address.slice(-6)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-faint)]">
            {chain?.name ?? "Unknown network"}
          </span>
          <button
            onClick={() => disconnect()}
            className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.1em] hover:text-[var(--red)] transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.1em]">Wallet</span>
        <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.1em]">0G Galileo · 16602</span>
      </div>
      <button
        onClick={() => connect({ connector: injected() })}
        disabled={isPending}
        className="w-full py-2.5 border border-[var(--border-soft)] text-[var(--text)] text-[11px] uppercase tracking-[0.12em] rounded hover:bg-[var(--bg-elev)] transition-colors disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect MetaMask / Injected →"}
      </button>
      <p className="text-[9px] text-[var(--text-faint)] leading-relaxed">
        Used for on-chain identity, royalty splits, and 0G Storage signing.
        iNFT minting requires ERC-7857 — <span className="text-[#ff9c00]">not yet on mainnet</span>.
      </p>
    </div>
  );
}

export default function ConnectPage() {
  const router = useRouter();

  const [tab, setTab]             = useState<Tab>("signin");
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [current, setCurrent]     = useState<string | null>(null);

  useEffect(() => {
    const a = loadAuth();
    if (a) setCurrent(a.username);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (tab === "register" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res =
        tab === "signin"
          ? await auth.login(username, password)
          : await auth.register(username, password);
      saveAuth(res.username, res.api_key);
      router.push("/marketplace");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Connection failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSignOut() {
    clearAuth();
    setCurrent(null);
  }

  if (current) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full flex flex-col gap-5">
          <Link href="/" className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.14em] hover:text-[var(--text-muted)] transition-colors">
            ← Back
          </Link>
          <div className="p-5 rounded border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--green)]" style={{ animation: "pulse 2s infinite" }} />
              <span className="text-[12px] text-[var(--text)]">Signed in as <b className="font-normal text-[var(--green)]">{current}</b></span>
            </div>
            <div className="flex gap-2">
              <Link href="/marketplace" className="flex-1 py-2 bg-[var(--green)] text-black text-[10px] font-bold uppercase tracking-[0.12em] rounded text-center hover:opacity-90 transition-opacity">
                Go to App →
              </Link>
              <button onClick={handleSignOut} className="px-3 py-2 border border-[var(--border)] text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] rounded hover:border-[var(--border-soft)] transition-colors">
                Sign Out
              </button>
            </div>
          </div>
          <WalletSection />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full flex flex-col gap-5">
        <div>
          <Link href="/" className="text-[10px] text-[var(--text-faint)] uppercase tracking-[0.14em] hover:text-[var(--text-muted)] transition-colors mb-3 block">
            ← Back
          </Link>
          <h2 className="text-[28px] text-[var(--text)]" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            Connect
          </h2>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Wallet for on-chain identity · API key for inference.
          </p>
        </div>

        <WalletSection />

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.1em]">Orchestrator</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        <div className="flex border border-[var(--border)] rounded overflow-hidden">
          {(["signin", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className={`flex-1 py-2 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                tab === t
                  ? "bg-[var(--bg-elev)] text-[var(--text)]"
                  : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              }`}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alice"
              required
              autoComplete="username"
              className="px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-soft)] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 6 characters"
              required
              autoComplete={tab === "signin" ? "current-password" : "new-password"}
              className="px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-soft)] transition-colors"
            />
          </div>

          {tab === "register" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="repeat password"
                required
                autoComplete="new-password"
                className="px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--bg-panel)] text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-soft)] transition-colors"
              />
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded border border-[#ff4f6e44] bg-[#ff4f6e0d] text-[11px] text-[var(--red)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="py-3 bg-[var(--green)] text-black text-[11px] font-bold uppercase tracking-[0.12em] rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          >
            {submitting ? "…" : tab === "signin" ? "Sign In →" : "Create Account →"}
          </button>
        </form>

        {tab === "register" && (
          <p className="text-[10px] text-[var(--text-faint)] text-center leading-relaxed">
            Your API key is generated on registration and stored locally.
            On-chain identity via 0G iNFT <SimPill /> coming soon.
          </p>
        )}
      </div>
    </main>
  );
}
