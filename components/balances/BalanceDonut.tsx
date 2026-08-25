"use client";

import React, { useMemo, useSyncExternalStore } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { PolicyUnit } from "@/lib/absencePolicies";
import { AppIcon } from "@/components/ui/AppIcon";
import { Skeleton } from "@/components/ui/Skeleton";

type Props = {
  used: number;
  reserved: number;
  available: number | null; // si null -> sin cupo
  allowance: number | null;
  unit: PolicyUnit;
};

function unitShort(u: PolicyUnit) {
  return u === "hour" ? "h" : "d";
}

const subscribeToClient = () => () => undefined;

export default function BalanceDonut({
  used,
  reserved,
  available,
  allowance,
  unit,
}: Props) {
  const mounted = useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false
  );

  const data = useMemo(() => {
    const safeUsed = Math.max(0, Number(used) || 0);
    const safeReserved = Math.max(0, Number(reserved) || 0);

    if (allowance == null || available == null) {
      return [
        { name: "Usado", value: safeUsed, color: "#fb7185" },
        { name: "Reservado", value: safeReserved, color: "#fbbf24" },
      ];
    }

    const safeAvailable = Math.max(0, Number(available) || 0);

    return [
      { name: "Usado", value: safeUsed, color: "#fb7185" },
      { name: "Reservado", value: safeReserved, color: "#fbbf24" },
      { name: "Disponible", value: safeAvailable, color: "#34d399" },
    ];
  }, [used, reserved, available, allowance]);

  const total = allowance ?? Math.max(0, (Number(used) || 0) + (Number(reserved) || 0));
  const chartTotal = data.reduce((sum, item) => sum + item.value, 0);
  const centerValue = available == null ? chartTotal : Math.max(0, Number(available) || 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-lll-border bg-lll-bg-softer">
      <header className="flex items-center justify-between gap-3 border-b border-lll-border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
            <AppIcon name="balance" className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Distribución del saldo</h3>
            <p className="mt-0.5 text-[11px] text-lll-text-soft">
              Total de la política: {total} {unitShort(unit)}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-lll-border bg-lll-bg px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-lll-text-soft">
          {unit === "hour" ? "Horas" : "Días"}
        </span>
      </header>

      <div className="grid items-center gap-2 p-4 sm:grid-cols-[minmax(220px,1.15fr)_minmax(180px,0.85fr)] sm:p-5">
        <div className="relative mx-auto h-[230px] w-full max-w-[340px]">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  wrapperStyle={{ outline: "none" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(9,14,28,0.96)",
                    color: "white",
                    boxShadow: "0 18px 48px rgba(0,0,0,.28)",
                  }}
                  labelStyle={{ color: "white" }}
                  itemStyle={{ color: "white" }}
                />
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius={70}
                  outerRadius={96}
                  paddingAngle={3}
                  cornerRadius={5}
                  stroke="transparent"
                  isAnimationActive
                  animationBegin={80}
                  animationDuration={700}
                  animationEasing="ease-out"
                >
                  {data.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full w-full items-center justify-center" role="status">
              <Skeleton className="h-44 w-44 rounded-full" />
              <span className="sr-only">Preparando gráfico...</span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[10px] uppercase tracking-[0.12em] text-lll-text-soft">
              {available == null ? "Registrado" : "Disponible"}
            </p>
            <p className="mt-1 text-3xl font-semibold leading-none text-lll-text">
              {centerValue}
              <span className="ml-1 text-xs font-medium text-lll-text-soft">
                {unitShort(unit)}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {data.map((item) => {
            const percentage = chartTotal > 0 ? Math.round((item.value / chartTotal) * 100) : 0;
            return (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-lll-border bg-lll-bg px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] text-lll-text-soft">{item.name}</p>
                    <p className="mt-0.5 text-sm font-semibold">
                      {item.value} {unitShort(unit)}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-lll-text-soft">{percentage}%</span>
              </div>
            );
          })}

          {allowance == null ? (
            <div className="flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2.5 text-[11px] leading-4 text-sky-100/80">
              <AppIcon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Esta política no tiene un cupo máximo definido.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
