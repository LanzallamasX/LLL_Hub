"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import BalanceDonut from "@/components/balances/BalanceDonut";

import { useAbsences } from "@/contexts/AbsencesContext";
import { useAuth } from "@/contexts/AuthContext";

import { computeBalanceStatsByKey, buildHistoryRows } from "@/lib/balances/stats";
import { POLICIES, type BalanceKey, type PolicyUnit } from "@/lib/absencePolicies";
import { getAbsenceTypeLabel } from "@/lib/absenceTypes";

function monthLabel(year: number, month0: number) {
  const d = new Date(year, month0, 1);
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(rows: any[]) {
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const headers = Object.keys(rows[0] ?? {});
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))];
  return lines.join("\n");
}

type StatRow = {
  balanceKey: BalanceKey;
  label: string;
  unit: PolicyUnit;
  allowance: number | null;
  used: number;
  reserved: number;
  available: number | null;
};

export default function BalancesPage() {
  const router = useRouter();
  const { userId, isAuthed, isLoading } = useAuth();
  const { absences, loadMyAbsences } = useAbsences();

  const didLoad = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthed || !userId) {
      router.replace("/login");
      return;
    }
    if (!didLoad.current) {
      didLoad.current = true;
      loadMyAbsences(userId);
    }
  }, [isLoading, isAuthed, userId, router, loadMyAbsences]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState<number | "all">(now.getMonth());
  const [selectedKey, setSelectedKey] = useState<BalanceKey | null>(null);

  const myAbsences = useMemo(() => {
    if (!userId) return [];
    return absences.filter((a) => a.userId === userId);
  }, [absences, userId]);

  // statsMap: puede venir "incompleto" (solo keys con movimiento)
  const statsMap = useMemo(() => {
    return computeBalanceStatsByKey(myAbsences, year, month0 === "all" ? undefined : month0);
  }, [myAbsences, year, month0]);

  // ✅ Catálogo completo (desde POLICIES), dedup por balanceKey
  const breakdownCatalog = useMemo(() => {
    const rows = POLICIES
      .filter((p) => p.deducts && p.deductsFrom) // solo lo que descuenta saldo
      .map((p) => ({
        balanceKey: p.deductsFrom as BalanceKey,
        unit: p.unit as PolicyUnit,
        allowance: p.allowance ?? null,
        label:
          p.type === "licencia"
            ? getAbsenceTypeLabel("licencia", p.subtype ?? null)
            : getAbsenceTypeLabel(p.type as any),
      }));

    // dedup por balanceKey (ej: BIRTHDAY_DAY puede venir de 2 policies)
    const byKey = new Map<BalanceKey, { balanceKey: BalanceKey; unit: PolicyUnit; allowance: number | null; label: string }>();
    for (const r of rows) {
      if (!byKey.has(r.balanceKey)) byKey.set(r.balanceKey, r);
    }
    return Array.from(byKey.values());
  }, []);

  // ✅ Lista final: catálogo completo + stats (o 0 si no hay)
  const statsList: StatRow[] = useMemo(() => {
    const list = breakdownCatalog.map((def) => {
      const s = statsMap.get(def.balanceKey);

      const used = s?.used ?? 0;
      const reserved = s?.reserved ?? 0;

      // Si allowance es null => "sin cupo" (available null)
      const allowance = def.allowance;
      const available = allowance == null ? null : Math.max(0, allowance - used - reserved);

      return {
        balanceKey: def.balanceKey,
        label: def.label,
        unit: (s?.unit ?? def.unit) as PolicyUnit,
        allowance,
        used,
        reserved,
        available,
      };
    });

    // Orden lindo: primero por label (o por balanceKey si preferís)
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [breakdownCatalog, statsMap]);

  useEffect(() => {
    if (!selectedKey && statsList.length) setSelectedKey(statsList[0].balanceKey);
  }, [selectedKey, statsList]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return statsList.find((x) => x.balanceKey === selectedKey) ?? null;
  }, [selectedKey, statsList]);

  const history = useMemo(() => {
    return buildHistoryRows(myAbsences, year, month0 === "all" ? undefined : month0);
  }, [myAbsences, year, month0]);

  const exportRows = useMemo(() => {
    return history.map((r) => ({
      id: r.id,
      desde: r.dateFrom,
      hasta: r.dateTo,
      estado: r.status,
      tipo: r.type,
      balanceKey: r.balanceKey,
      unidad: r.unit,
      cantidad: r.amount,
      nota: r.note ?? "",
    }));
  }, [history]);

  return (
    <UserLayout mode="user" header={{ title: "Balances", subtitle: "Cupos, usados, reservados (pendientes) e historial." }}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: filtros + breakdown */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
            <p className="text-sm font-semibold">Filtros</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[12px] text-lll-text-soft">Año</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="text-[12px] text-lll-text-soft">Mes</label>
                <select
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                  value={month0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMonth0(v === "all" ? "all" : Number(v));
                  }}
                >
                  <option value="all">Todo el año</option>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i} value={i}>
                      {new Date(2020, i, 1).toLocaleDateString("es-AR", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-lll-accent text-black font-semibold"
                onClick={() => {
                  if (!exportRows.length) return;
                  const csv = toCSV(exportRows);
                  downloadCSV(`balances_${year}_${month0 === "all" ? "all" : month0 + 1}.csv`, csv);
                }}
              >
                Export CSV
              </button>
            </div>

            <p className="mt-2 text-[12px] text-lll-text-soft">
              {month0 === "all" ? `Año ${year}` : monthLabel(year, month0)}
            </p>
          </div>

          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
            <p className="text-sm font-semibold">Breakdown</p>

            <div className="mt-3 space-y-2">
              {statsList.length === 0 && <p className="text-[12px] text-lll-text-soft">No hay datos aún.</p>}

              {statsList.map((s) => (
                <button
                  key={s.balanceKey}
                  type="button"
                  onClick={() => setSelectedKey(s.balanceKey)}
                  className={`w-full text-left rounded-xl border px-3 py-2 ${
                    selectedKey === s.balanceKey ? "border-lll-accent/60 bg-lll-accent-soft" : "border-lll-border bg-lll-bg-softer"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span className="text-[12px] text-lll-text-soft">
                      {s.allowance == null ? "sin cupo" : `cupo ${s.allowance}${s.unit === "hour" ? "h" : "d"}`}
                    </span>
                  </div>

                  <p className="mt-1 text-[12px] text-lll-text-soft">
                    Usado: {s.used}
                    <span className="opacity-70"> · </span>
                    Reservado: {s.reserved}
                    <span className="opacity-70"> · </span>
                    Disponible: {s.available == null ? "—" : s.available}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: donut + historial */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <BalanceDonut
              used={selected.used}
              reserved={selected.reserved}
              available={selected.available}
              allowance={selected.allowance}
              unit={selected.unit}
            />
          ) : (
            <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
              Seleccioná una política para ver el donut.
            </div>
          )}

          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Historial</p>
              <p className="text-[12px] text-lll-text-soft">Incluye: aprobado + pendiente</p>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[12px] text-lll-text-soft">
                  <tr className="border-b border-lll-border">
                    <th className="py-2 text-left">Desde</th>
                    <th className="py-2 text-left">Hasta</th>
                    <th className="py-2 text-left">Tipo</th>
                    <th className="py-2 text-left">Estado</th>
                    <th className="py-2 text-left">BalanceKey</th>
                    <th className="py-2 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-b border-lll-border/60">
                      <td className="py-2">{r.dateFrom}</td>
                      <td className="py-2">{r.dateTo}</td>
                      <td className="py-2">{r.type}</td>
                      <td className="py-2">{r.status}</td>
                      <td className="py-2">{r.balanceKey}</td>
                      <td className="py-2 text-right">
                        {r.amount} {r.unit === "hour" ? "h" : "d"}
                      </td>
                    </tr>
                  ))}

                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-[12px] text-lll-text-soft">
                        Sin movimientos en este rango.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
