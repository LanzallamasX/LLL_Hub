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
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-lll-border bg-white/[0.015] px-2.5 py-2 text-[10px] text-lll-text-soft">
        <span>Sin límite definido</span>
        <span>{used + reserved}{fmtUnit(unit)} registrados</span>
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
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-lll-bg border border-lll-border"
        aria-label={`Usado ${used}${fmtUnit(unit)}, reservado ${reserved}${fmtUnit(unit)}, disponible ${av}${fmtUnit(unit)}`}
      >
        <div className="lll-progress-reveal h-full flex">
          <div
            className="h-full bg-rose-400"
            style={{ width: `${usedP}%` }}
          />
          <div
            className="h-full bg-amber-300"
            style={{ width: `${resP}%` }}
          />
          <div
            className="h-full bg-emerald-400"
            style={{ width: `${avP}%` }}
          />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-lll-text-soft">
        <span className="flex items-center gap-1.5 truncate">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
          {used}{fmtUnit(unit)} usado
        </span>
        <span className="flex items-center justify-center gap-1.5 truncate">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
          {reserved}{fmtUnit(unit)} reservado
        </span>
        <span className="flex items-center justify-end gap-1.5 truncate">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
          {av}{fmtUnit(unit)} libre
        </span>
      </div>
    </div>
  );
}
