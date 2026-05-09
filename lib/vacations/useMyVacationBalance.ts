"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMyVacationBalance, type VacationBalance } from "@/lib/supabase/vacations";
import { supabase } from "@/lib/supabase/client";

export function useMyVacationBalance(
  enabled = true,
  opts?: {
    pAt?: string | null;
    policyMode?: "anniversary" | "october";
    userId?: string | null;
  }
) {
  const [data, setData] = useState<VacationBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);
      const res =
        opts?.policyMode === "october" && opts?.userId
          ? await supabase
              .rpc("get_vacation_balance_october_preview_for_user_at", {
                p_user_id: opts.userId,
                p_at: opts.pAt ?? undefined,
              })
              .then(({ data, error }) => {
                if (error) throw error;
                return data as VacationBalance;
              })
          : await fetchMyVacationBalance(opts?.pAt ?? undefined);
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando balance de vacaciones.");
    } finally {
      setLoading(false);
    }
  }, [enabled, opts?.pAt, opts?.policyMode, opts?.userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
