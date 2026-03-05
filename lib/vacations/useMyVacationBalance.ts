"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMyVacationBalance, type VacationBalance } from "@/lib/supabase/vacations";

export function useMyVacationBalance(enabled = true) {
  const [data, setData] = useState<VacationBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);
      const res = await fetchMyVacationBalance();
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando balance de vacaciones.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}