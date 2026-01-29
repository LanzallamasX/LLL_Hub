"use client";

import React, { useMemo } from "react";
import type { BalanceKey } from "@/lib/absencePolicies";
import { POLICIES } from "@/lib/absencePolicies";

type Usage = { used: number; unit: "day" | "hour" };

type BalanceItem = {
  key: BalanceKey;
  label: string;
  unit: "day" | "hour";
  allowance: number; // cupo
  used: number; // usado
  available: number; // disponible
  pct: number; // 0..100
  tone: "ok" | "warn" | "danger";
};

type Props = {
  usageByKey: Map<BalanceKey, Usage>;
  // Vacaciones viene por otro cálculo (entitlement/carryover/etc). Para la tarjeta, pasamos un número simple:
  vacationAvailable?: number;
  vacationAllowance?: number | null; // si querés mostrar cupo total, si no, lo ocultamos
  // Si querés, podés ocultar algunos keys
  hideKeys?: BalanceKey[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function unitLabel(unit: "day" | "hour", n: number) {
  if (unit === "hour") return n === 1 ? "hora" : "horas";
  return n === 1 ? "día" : "días";
}

function labelForKey(key: BalanceKey) {
  switch (key) {
    case "HOME_OFFICE_DAYS":
      return "Home Office";
    case "BIRTHDAY_DAY":
      return "Cumpleaños";
    case "LIC_FAMILY_CARE_DAYS":
      return "Grupo familiar";
    case "LIC_EXAMS_DAYS":
      return "Exámenes";
    case "LIC_BEREAVEMENT_CLOSE_DAYS":
      return "Fallecimiento (cónyuge/hijo/padres)";
    case "LIC_BEREAVEMENT_SIBLING_DAYS":
      return "Fallecimiento (hermano/a)";
    case "LIC_PATERNITY_DAYS":
      return "Paternidad";
    case "LIC_MATERNITY_DAYS":
      return "Maternidad";
    case "LIC_MOVING_DAYS":
      return "Mudanza";
    case "LIC_LCT_PERSONAL_DAYS":
      return "Razones particulares (LCT)";
    case "LIC_PERSONAL_TRAMITE_HOURS":
      return "Trámite personal";
    case "LIC_MEDICAL_APPT_HOURS":
      return "Turno médico";
    case "VACATION_DAYS":
      return "Vacaciones";
    default:
      return key;
  }
}

// saca allowance/unit por key mirando POLICIES
function policyMetaByKey(key: BalanceKey) {
  const p = POLICIES.find((x) => x.deducts && x.deductsFrom === key) ?? null;
  if (!p) return null;
  if (p.allowance == null) return { allowance: null as number | null, unit: p.unit };
  return { allowance: p.allowance, unit: p.unit };
}

export default function BalancesSummary({
  usageByKey,
  vacationAvailable,
  vacationAllowance,
  hideKeys = [],
}: Props) {
  const items: BalanceItem[] = useMemo(() => {
    const res: BalanceItem[] = [];

    // 1) Vacaciones (viene por computeVacationBalance)
    if (!hideKeys.includes("VACATION_DAYS")) {
      if (typeof vacationAvailable === "number") {
        const used = usageByKey.get("VACATION_DAYS")?.used ?? 0;
        const allowance = typeof vacationAllowance === "number" ? vacationAllowance : Math.max(used + vacationAvailable, 0);
        const available = vacationAvailable;
        const pct = allowance > 0 ? (used / allowance) * 100 : 0;
        const tone: BalanceItem["tone"] = pct >= 90 ? "danger" : pct >= 75 ? "warn" : "ok";

        res.push({
          key: "VACATION_DAYS",
          label: "Vacaciones",
          unit: "day",
          allowance,
          used,
          available,
          pct: clamp(pct, 0, 100),
          tone,
        });
      }
    }

    // 2) Todas las demás policies con allowance numérica (ej HO 15, licencias, etc.)
    const keys = Array.from(usageByKey.keys());
    // sumamos también keys que aún no tengan usado (para mostrar 0 usado)
    // tomamos desde POLICIES para tener listado completo
    const allPolicyKeys = POLICIES
      .filter((p) => p.deducts && p.deductsFrom && p.allowance != null)
      .map((p) => p.deductsFrom!) as BalanceKey[];

    const uniqueKeys = Array.from(new Set([...keys, ...allPolicyKeys]))
      .filter((k) => k !== "VACATION_DAYS")
      .filter((k) => !hideKeys.includes(k));

    for (const key of uniqueKeys) {
      const meta = policyMetaByKey(key);
      if (!meta) continue;
      if (meta.allowance == null) continue; // si no hay cupo, no mostramos tarjeta en este resumen

      const used = usageByKey.get(key)?.used ?? 0;
      const allowance = meta.allowance;
      const available = Math.max(0, allowance - used);
      const pct = allowance > 0 ? (used / allowance) * 100 : 0;
      const tone: BalanceItem["tone"] = pct >= 90 ? "danger" : pct >= 75 ? "warn" : "ok";

      res.push({
        key,
        label: labelForKey(key),
        unit: meta.unit,
        allowance,
        used,
        available,
        pct: clamp(pct, 0, 100),
        tone,
      });
    }

    // orden: vacaciones primero ya está, luego por “más consumido”
    return res.sort((a, b) => {
      if (a.key === "VACATION_DAYS") return -1;
      if (b.key === "VACATION_DAYS") return 1;
      return b.pct - a.pct;
    });
  }, [usageByKey, vacationAvailable, vacationAllowance, hideKeys]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Tus cupos</p>
          <p className="mt-1 text-[12px] text-lll-text-soft">
            Cupo · Usado · Disponible (por año / política)
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((it) => (
          <div
            key={it.key}
            className="rounded-2xl border border-lll-border bg-lll-bg-softer p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{it.label}</p>

              <span
                className={`text-[11px] px-2 py-1 rounded-full border ${
                  it.tone === "danger"
                    ? "bg-red-500/10 border-red-500/30 text-red-200"
                    : it.tone === "warn"
                      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200"
                      : "bg-lll-bg-soft border-lll-border text-lll-text-soft"
                }`}
              >
                {it.available} {unitLabel(it.unit, it.available)} disp.
              </span>
            </div>

            {/* Progress */}
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-lll-bg-soft border border-lll-border overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    it.tone === "danger"
                      ? "bg-red-400/80"
                      : it.tone === "warn"
                        ? "bg-yellow-400/80"
                        : "bg-lll-accent/80"
                  }`}
                  style={{ width: `${it.pct}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[12px] text-lll-text-soft">
                <span>
                  Cupo: <span className="text-lll-text">{it.allowance}</span> {unitLabel(it.unit, it.allowance)}
                </span>
                <span>
                  Usado: <span className="text-lll-text">{it.used}</span> {unitLabel(it.unit, it.used)}
                </span>
              </div>

              {it.tone !== "ok" && (
                <p className="mt-2 text-[12px] text-lll-text-soft">
                  {it.tone === "warn"
                    ? "Estás cerca del límite."
                    : "Estás al límite o lo superaste."}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
