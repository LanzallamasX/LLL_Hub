"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { PolicyUnit } from "@/lib/absencePolicies";

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

export default function BalanceDonut({
  used,
  reserved,
  available,
  allowance,
  unit,
}: Props) {
  // ✅ evita width/height -1 por hydration / layout no medido aún
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const safeUsed = Math.max(0, Number(used) || 0);
    const safeReserved = Math.max(0, Number(reserved) || 0);

    // Si no hay cupo (allowance null o available null), mostramos Used vs Reserved
    if (allowance == null || available == null) {
      return [
        { name: "Usado", value: safeUsed },
        { name: "Reservado", value: safeReserved },
      ];
    }

    const safeAvailable = Math.max(0, Number(available) || 0);

    return [
      { name: "Usado", value: safeUsed },
      { name: "Reservado", value: safeReserved },
      { name: "Disponible", value: safeAvailable },
    ];
  }, [used, reserved, available, allowance]);

  const COLORS = ["#F59E0B", "#60A5FA", "#34D399"]; // usado / reservado / disponible

  const total = allowance ?? Math.max(0, (Number(used) || 0) + (Number(reserved) || 0));

  return (
    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Balance</p>
        <span className="text-[12px] text-lll-text-soft">unidad: {unitShort(unit)}</span>
      </div>

      <div className="mt-4 w-full min-h-[220px] h-[220px]">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                wrapperStyle={{ outline: "none" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(10,10,10,0.85)",
                  color: "white",
                }}
              />
              <Pie
                data={data}
                dataKey="value"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                stroke="transparent"
                isAnimationActive={false} // ✅ reduce glitches en resize/hydration
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          // placeholder mínimo mientras monta
          <div className="h-full w-full rounded-xl border border-lll-border bg-lll-bg-softer" />
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
        <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-2">
          <p className="text-lll-text-soft">Usado</p>
          <p className="font-semibold">
            {Math.max(0, Number(used) || 0)} {unitShort(unit)}
          </p>
        </div>

        <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-2">
          <p className="text-lll-text-soft">Reservado</p>
          <p className="font-semibold">
            {Math.max(0, Number(reserved) || 0)} {unitShort(unit)}
          </p>
        </div>

        <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-2">
          <p className="text-lll-text-soft">Disponible</p>
          <p className="font-semibold">
            {available == null ? "—" : `${Math.max(0, Number(available) || 0)} ${unitShort(unit)}`}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[12px] text-lll-text-soft">
        Total política: {total ?? "—"} {unitShort(unit)}
      </p>
    </div>
  );
}
