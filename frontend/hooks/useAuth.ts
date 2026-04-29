"use client";

import { useEffect, useState } from "react";
import { loadAuth, clearAuth } from "@/lib/auth-store";

type Auth = { username: string; apiKey: string };

export function useAuth() {
  const [auth, setAuth]       = useState<Auth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuth(loadAuth());
    setLoading(false);
  }, []);

  const signOut = () => {
    clearAuth();
    setAuth(null);
  };

  return { auth, loading, signOut };
}
