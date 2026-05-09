"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMyVacationBalance, type VacationBalance } from "@/lib/supabase/vacations";

function fmt(n: number) {
  // si devolvés decimales, queda prolijo. Si querés enteros: Math.floor o toFixed(0)
  return Number.isFinite(n) ? n.toFixed(2).replace(/\.00$/, "") : "0";
}

export default function VacationBalanceCard() {
  const [data, setData] = useState<VacationBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetchMyVacationBalance();
        if (!alive) return;
        setData(res);
        setErr(null);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Error cargando balance de vacaciones.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const summary = useMemo(() => {
    if (!data) return null;

    const accrued = Number(data.granted ?? 0);
    const used = Number(data.used ?? 0);

    const reserved = Number((data as any).reserved ?? data.reserved ?? 0);
    const pending = Number((data as any).reserved_pending ?? data.reserved_pending ?? 0);

    const available = Number(data.available ?? 0);

    return { accrued, used, reserved, pending, available };
  }, [data]);

  return (
    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Vacaciones</p>
          <p className="mt-1 text-[12px] text-lll-text-soft">
            Acumulativas desde tu fecha de ingreso. Sin vencimiento. Disponible = Acumuladas − Usadas − Reservadas − Pendientes.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
          Cargando balance…
        </div>
      ) : null}

      {err ? (
        <div className="mt-3 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {!loading && summary ? (
        <div className="mt-4 grid grid-cols-2 min-[520px]:grid-cols-3 xl:grid-cols-3 gap-3">
          <div className="min-w-0 rounded-xl border border-lll-border bg-lll-bg p-3">
            <p className="truncate text-[10px] text-lll-text-soft">Acumuladas</p>
            <p className="mt-2 text-[clamp(1.5rem,5vw,1.875rem)] font-semibold leading-tight">{fmt(summary.accrued)}</p>
          </div>

          <div className="min-w-0 rounded-xl border border-lll-border bg-lll-bg p-3">
            <p className="truncate text-[10px] text-lll-text-soft">Usadas</p>
            <p className="mt-2 text-[clamp(1.5rem,5vw,1.875rem)] font-semibold leading-tight">{fmt(summary.used)}</p>
          </div>

          <div className="min-w-0 rounded-xl border border-lll-border bg-lll-bg p-3">
            <p className="truncate text-[10px] text-lll-text-soft">Reservadas</p>
            <p className="mt-2 text-[clamp(1.5rem,5vw,1.875rem)] font-semibold leading-tight">{fmt(summary.reserved)}</p>
          </div>

          <div className="min-w-0 rounded-xl border border-lll-border bg-lll-bg p-3">
            <p className="truncate text-[10px] text-lll-text-soft">Pendientes</p>
            <p className="mt-2 text-[clamp(1.5rem,5vw,1.875rem)] font-semibold leading-tight">{fmt(summary.pending)}</p>
          </div>

          <div className="min-w-0 rounded-xl border border-lll-border bg-lll-bg p-3">
            <p className="truncate text-[10px] text-lll-text-soft">Disponibles</p>
            <p className="mt-2 text-[clamp(1.5rem,5vw,1.875rem)] font-semibold leading-tight">{fmt(summary.available)}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
