"use client";

import { useEffect, useState } from "react";
import { fetchMyVacationBalance, type VacationBalance } from "@/lib/supabase/vacations";

export function useMyVacationBalance(enabled = true) {
  const [data, setData] = useState<VacationBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchMyVacationBalance();
        if (!alive) return;
        setData(res);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Error cargando balance de vacaciones.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [enabled]);

  return { data, loading, error };
}
