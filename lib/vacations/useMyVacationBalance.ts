"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMyVacationBalance, type VacationBalance } from "@/lib/supabase/vacations";
import { supabase } from "@/lib/supabase/client";

const balanceCache = new Map<string, VacationBalance>();
const balanceRequests = new Map<string, Promise<VacationBalance>>();

function getBalanceCacheKey(opts?: {
  pAt?: string | null;
  policyMode?: "anniversary" | "october";
  userId?: string | null;
}) {
  return [
    opts?.userId ?? "current-user",
    opts?.policyMode ?? "anniversary",
    opts?.pAt ?? "today",
  ].join(":");
}

function getErrorMessage(error: unknown) {
  return error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : "Error cargando balance de vacaciones.";
}

export function useMyVacationBalance(
  enabled = true,
  opts?: {
    pAt?: string | null;
    policyMode?: "anniversary" | "october";
    userId?: string | null;
  }
) {
  const cacheKey = getBalanceCacheKey(opts);
  const activeKeyRef = useRef(cacheKey);
  activeKeyRef.current = cacheKey;

  const [data, setData] = useState<VacationBalance | null>(
    () => balanceCache.get(cacheKey) ?? null
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;

    const cached = balanceCache.get(cacheKey) ?? null;
    if (cached) {
      setData(cached);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      let request = balanceRequests.get(cacheKey);
      if (!request) {
        request = (async (): Promise<VacationBalance> => {
          if (opts?.policyMode === "october" && opts?.userId) {
            const { data, error } = await supabase.rpc(
              "get_vacation_balance_october_preview_for_user_at",
              {
                p_user_id: opts.userId,
                p_at: opts.pAt ?? undefined,
              }
            );
            if (error) throw error;
            return data as VacationBalance;
          }

          return fetchMyVacationBalance(opts?.pAt ?? undefined);
        })();
        balanceRequests.set(cacheKey, request);
      }

      const res = await request;
      balanceCache.set(cacheKey, res);
      if (activeKeyRef.current === cacheKey) setData(res);
    } catch (e: unknown) {
      if (activeKeyRef.current === cacheKey) {
        setError(getErrorMessage(e));
      }
    } finally {
      balanceRequests.delete(cacheKey);
      if (activeKeyRef.current === cacheKey) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [cacheKey, enabled, opts?.pAt, opts?.policyMode, opts?.userId]);

  useEffect(() => {
    const cached = balanceCache.get(cacheKey) ?? null;
    setData(cached);
    setError(null);

    if (!enabled) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    void reload();
  }, [cacheKey, enabled, reload]);

  return { data, loading, refreshing, error, reload };
}
