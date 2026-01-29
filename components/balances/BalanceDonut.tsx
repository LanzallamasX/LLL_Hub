"use client";

import React, { useMemo } from "react";
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

export default function BalanceDonut({ used, reserved, available, allowance, unit }: Props) {
  const data = useMemo(() => {
    // Si no hay cupo (allowance null), mostramos Used vs Reserved solamente
    if (allowance == null || available == null) {
      return [
        { name: "Usado", value: Math.max(0, used) },
        { name: "Reservado", value: Math.max(0, reserved) },
      ];
    }

    return [
      { name: "Usado", value: Math.max(0, used) },
      { name: "Reservado", value: Math.max(0, reserved) },
      { name: "Disponible", value: Math.max(0, available) },
    ];
  }, [used, reserved, available, allowance]);

  // colores: NO hardcodeo paleta compleja, solo 3 tonos básicos compatibles con tu UI
  const COLORS = ["#F59E0B", "#60A5FA", "#34D399"]; // usado / reservado / disponible

  const total = allowance ?? (used + reserved);

  return (
    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Balance</p>
        <span className="text-[12px] text-lll-text-soft">
          unidad: {unitShort(unit)}
        </span>
      </div>

      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip />
            <Pie
              data={data}
              dataKey="value"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              stroke="transparent"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
        <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-2">
          <p className="text-lll-text-soft">Usado</p>
          <p className="font-semibold">{used} {unitShort(unit)}</p>
        </div>
        <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-2">
          <p className="text-lll-text-soft">Reservado</p>
          <p className="font-semibold">{reserved} {unitShort(unit)}</p>
        </div>
        <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-2">
          <p className="text-lll-text-soft">Disponible</p>
          <p className="font-semibold">
            {available == null ? "—" : `${available} ${unitShort(unit)}`}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[12px] text-lll-text-soft">
        Total política: {total ?? "—"} {unitShort(unit)}
      </p>
    </div>
  );
}
