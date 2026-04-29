"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { state as apiState, type ApiState, ApiError } from "@/lib/api";
import { loadAuth } from "@/lib/auth-store";

const POLL_MS = 10_000;

export function useApiState() {
  const [data, setData]       = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = useCallback(async () => {
    if (!loadAuth()) {
      setLoading(false);
      setError("unauthenticated");
      return;
    }
    try {
      const d = await apiState.get();
      setData(d);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.status === 401 ? "unauthenticated" : e.message);
      } else {
        setError("Network error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch();
  }, [fetch]);

  useEffect(() => {
    fetch();
    timerRef.current = setInterval(fetch, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch]);

  return { data, loading, error, refresh };
}
