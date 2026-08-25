"use client";

import { useMemo } from "react";
import type { VacationBalance } from "@/lib/supabase/vacations";
import { AppIcon } from "@/components/ui/AppIcon";
import { Skeleton } from "@/components/ui/Skeleton";

function fmt(n: number) {
  // si devolvés decimales, queda prolijo. Si querés enteros: Math.floor o toFixed(0)
  return Number.isFinite(n) ? n.toFixed(2).replace(/\.00$/, "") : "0";
}

export default function VacationBalanceCard({
  data,
  loading = false,
  error = null,
}: {
  data: VacationBalance | null;
  loading?: boolean;
  error?: string | null;
}) {

  const summary = useMemo(() => {
    if (!data) return null;

    const accrued = Number(data.granted ?? 0);
    const used = Number(data.used ?? 0);

    const reserved = Number(data.reserved ?? 0);
    const pending = Number(data.reserved_pending ?? 0);

    const available = Number(data.available ?? 0);

    return { accrued, used, reserved, pending, available };
  }, [data]);

  const availablePercent = summary?.accrued
    ? Math.max(0, Math.min(100, (summary.available / summary.accrued) * 100))
    : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-lll-border bg-lll-bg-soft">
      <div className="border-b border-lll-border bg-gradient-to-br from-cyan-400/[0.08] via-transparent to-transparent p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
              <AppIcon name="balance" className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Balance de vacaciones</h2>
              <p className="mt-1 text-[12px] leading-5 text-lll-text-soft">
                Tu saldo acumulado y los días ya comprometidos.
              </p>
            </div>
          </div>

          {!loading && summary ? (
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-[0.12em] text-lll-text-soft">Disponible</p>
              <p className="mt-1 text-2xl font-semibold leading-none text-cyan-200">
                {fmt(summary.available)}{" "}
                <span className="text-xs font-medium text-lll-text-soft">d</span>
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div
          className="grid grid-cols-2 gap-3 p-4 sm:p-5"
          role="status"
          aria-label="Cargando balance de vacaciones"
        >
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-lll-border bg-lll-bg p-3"
            >
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="mt-3 h-8 w-12" />
            </div>
          ))}
          <span className="sr-only">Cargando balance...</span>
        </div>
      ) : null}

      {error ? (
        <div className="m-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 sm:m-5">
          {error}
        </div>
      ) : null}

      {!loading && summary ? (
        <div className="lll-fade-in p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            {[
              ["Acumuladas", summary.accrued],
              ["Usadas", summary.used],
              ["Reservadas", summary.reserved],
              ["Pendientes", summary.pending],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-lll-border bg-lll-bg p-3">
                <p className="truncate text-[10px] text-lll-text-soft">{label}</p>
                <p className="mt-1 text-lg font-semibold leading-tight">{fmt(Number(value))}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-lll-text-soft">
              <span>Saldo disponible</span>
              <span>{Math.round(availablePercent)}% del acumulado</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-lll-bg">
              <div
                className="h-full rounded-full bg-cyan-400 transition-[width] duration-500"
                style={{ width: `${availablePercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
