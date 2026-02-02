"use client";

import type { PolicyUnit } from "@/lib/absencePolicies";

function fmtUnit(unit: PolicyUnit) {
  return unit === "hour" ? "h" : "d";
}

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

function pct(part: number, total: number) {
  if (!total || total <= 0) return 0;
  return clamp((part / total) * 100);
}

export default function BalanceBar({
  used,
  reserved,
  available,
  allowance,
  unit,
}: {
  used: number;
  reserved: number;
  available: number | null;
  allowance: number | null;
  unit: PolicyUnit;
}) {
  if (allowance == null) {
    return (
      <div className="mt-3 rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2 text-[12px] text-lll-text-soft">
        Sin cupo definido
      </div>
    );
  }

  const a = allowance;
  const av = available ?? Math.max(0, a - used - reserved);

  const usedP = pct(used, a);
  const resP = pct(reserved, a);
  const avP = clamp(100 - usedP - resP);

  return (
    <div className="mt-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-lll-bg-softer border border-lll-border">
        <div className="h-full flex">
          <div
            className="h-full bg-orange-400/90"
            style={{ width: `${usedP}%` }}
            aria-label="Usado"
          />
          <div
            className="h-full bg-sky-400/80"
            style={{ width: `${resP}%` }}
            aria-label="Reservado"
          />
          <div
            className="h-full bg-lll-accent"
            style={{ width: `${avP}%` }}
            aria-label="Disponible"
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[12px] text-lll-text-soft">
        <span>Usado: {used}{fmtUnit(unit)}</span>
        <span>Reservado: {reserved}{fmtUnit(unit)}</span>
        <span>Disponible: {av}{fmtUnit(unit)}</span>
      </div>
    </div>
  );
}
