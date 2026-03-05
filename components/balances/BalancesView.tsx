"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import BalanceDonut from "@/components/balances/BalanceDonut";
import BalanceBar from "@/components/balances/BalanceBar";

import { useAbsences } from "@/contexts/AbsencesContext";

import { buildHistoryRows, computeBalanceStatsByKey } from "@/lib/balances/stats";
import { POLICIES, type BalanceKey, type PolicyUnit } from "@/lib/absencePolicies";
import { getAbsenceTypeLabel } from "@/lib/absenceTypes";

import { supabase } from "@/lib/supabase/client";

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

function fmtUnit(unit: PolicyUnit) {
  return unit === "hour" ? "h" : "d";
}

function endOfMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0);
}
function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD -> Date (local, estable) */
function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** start + months */
function addMonths(d: Date, months: number) {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + months);
  return x;
}

/** años completos (antigüedad) al "at" */
function fullYearsBetween(start: Date, at: Date) {
  let years = at.getFullYear() - start.getFullYear();
  const a = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const ann = new Date(at.getFullYear(), start.getMonth(), start.getDate());
  if (a < ann) years -= 1;
  return Math.max(0, years);
}

/** tu escala */
function vacationDaysBySeniority(years: number) {
  if (years < 5) return 14;
  if (years < 10) return 21;
  if (years < 20) return 28;
  return 35;
}

/** cupo anual “por antigüedad” (solo informativo) */
function annualEntitlementBySeniority(startDateISO: string, atISO: string) {
  const start = parseISODate(startDateISO);
  const at = parseISODate(atISO);

  // regla: antes de 6 meses, todavía no hay “cupo anual”
  const cut = addMonths(start, 6);
  if (at < cut) return 0;

  const years = fullYearsBetween(start, at);
  return vacationDaysBySeniority(years);
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

type VacRpc = {
  granted: number;
  used: number;
  reserved: number;
  available: number;
};

export default function BalancesView({
  targetUserId,
  startDateISO,
}: {
  targetUserId: string;
  startDateISO: string | null;
}) {
  const { absences, loadMyAbsences } = useAbsences();
  const didLoad = useRef(false);

  // periodo UI
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState<number | "all">(now.getMonth());
  const [selectedKey, setSelectedKey] = useState<BalanceKey | null>(null);

  // UI: buscador + toggle
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  // vacaciones por RPC (owner)
  const [vacRpc, setVacRpc] = useState<VacRpc | null>(null);
  const [vacLoading, setVacLoading] = useState(false);

  useEffect(() => {
    if (!targetUserId) return;
    if (!didLoad.current) {
      didLoad.current = true;
      loadMyAbsences(targetUserId);
    }
  }, [targetUserId, loadMyAbsences]);

  const myAbsences = useMemo(() => {
    if (!targetUserId) return [];
    return absences.filter((a) => a.userId === targetUserId);
  }, [absences, targetUserId]);

  // vacAt por URL (si existe)
  const vacAtFromUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const v = (sp.get("vacAt") ?? "").trim();
    return v || null; // YYYY-MM-DD
  }, []);

  // fecha "at" efectiva para vacaciones
  const periodAtISO = useMemo(() => {
    if (vacAtFromUrl) return vacAtFromUrl;
    if (month0 === "all") return `${year}-12-31`;
    return toISODate(endOfMonth(year, month0));
  }, [vacAtFromUrl, year, month0]);

  // ✅ cupo anual por antigüedad (informativo)
  const vacAnnualEntitlement = useMemo(() => {
    if (!startDateISO) return null;
    return annualEntitlementBySeniority(startDateISO, periodAtISO);
  }, [startDateISO, periodAtISO]);

  // OWNER RPC: trae balance real
  useEffect(() => {
    if (!targetUserId) return;

    (async () => {
      try {
        setVacLoading(true);

        const { data, error } = await supabase.rpc("get_vacation_balance_for_user_at", {
          p_user_id: targetUserId,
          p_at: periodAtISO,
        });

        if (error) throw error;

        setVacRpc({
          granted: Number(data?.granted ?? 0),
          used: Number(data?.used ?? 0),
          reserved: Number(data?.reserved ?? 0),
          available: Number(data?.available ?? 0),
        });
      } catch (e) {
        console.error("OWNER get_vacation_balance_for_user_at error", e);
        setVacRpc(null);
      } finally {
        setVacLoading(false);
      }
    })();
  }, [targetUserId, periodAtISO]);

  const statsMap = useMemo(() => {
    const map = computeBalanceStatsByKey(
      myAbsences,
      year,
      month0 === "all" ? undefined : month0
    );

    // ✅ Vacaciones: el gráfico usa el acumulado real (granted)
    if (vacRpc) {
      map.set("VACATION_DAYS", {
        balanceKey: "VACATION_DAYS",
        unit: "day",
        allowance: vacRpc.granted, // TOTAL acumulado (para Bar/Donut)
        used: vacRpc.used,
        reserved: vacRpc.reserved,
        available: vacRpc.available,
      });
    }

    return map;
  }, [myAbsences, year, month0, vacRpc]);

  const breakdownCatalog = useMemo(() => {
    const rows = POLICIES.filter((p) => p.deducts && p.deductsFrom).map((p) => ({
      balanceKey: p.deductsFrom as BalanceKey,
      unit: p.unit as PolicyUnit,
      allowance: p.allowance ?? null,
      label:
        p.type === "licencia"
          ? getAbsenceTypeLabel("licencia", p.subtype ?? null)
          : getAbsenceTypeLabel(p.type as any),
    }));

    const byKey = new Map<BalanceKey, (typeof rows)[number]>();
    for (const r of rows) if (!byKey.has(r.balanceKey)) byKey.set(r.balanceKey, r);
    return Array.from(byKey.values());
  }, []);

  const statsList = useMemo<StatRow[]>(() => {
    const list = breakdownCatalog.map((def) => {
      const s = statsMap.get(def.balanceKey);

      const used = s?.used ?? 0;
      const reserved = s?.reserved ?? 0;

      const allowance = s?.allowance ?? def.allowance;
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

    return list.sort((a, b) => {
      const aHas = a.allowance != null ? 0 : 1;
      const bHas = b.allowance != null ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.label.localeCompare(b.label);
    });
  }, [breakdownCatalog, statsMap]);

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

  const rangeLabel = month0 === "all" ? `Año ${year}` : monthLabel(year, month0);

  const filteredStatsList = useMemo(() => {
    const query = q.trim().toLowerCase();
    const hasQuery = query.length > 0;

    let list = statsList;

    if (hasQuery) {
      list = list.filter((s) => s.label.toLowerCase().includes(query));
      return list;
    }

    if (showAll) return list;

    return list.filter((s) => {
      const hasAllowance = s.allowance != null;
      const hasAvail = (s.available ?? 0) > 0;
      return hasAllowance && hasAvail;
    });
  }, [statsList, q, showAll]);

  const hiddenCount = useMemo(() => {
    const query = q.trim();
    if (query) return 0;
    if (showAll) return 0;
    return Math.max(0, statsList.length - filteredStatsList.length);
  }, [statsList.length, filteredStatsList.length, q, showAll]);

  useEffect(() => {
    if (!filteredStatsList.length) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey) {
      setSelectedKey(filteredStatsList[0].balanceKey);
      return;
    }
    const stillThere = filteredStatsList.some((x) => x.balanceKey === selectedKey);
    if (!stillThere) setSelectedKey(filteredStatsList[0].balanceKey);
  }, [selectedKey, filteredStatsList]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return statsList.find((x) => x.balanceKey === selectedKey) ?? null;
  }, [selectedKey, statsList]);

  const showVacInfo = (key: BalanceKey) => key === "VACATION_DAYS";

  return (
    <div>
      {/* Top bar */}
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[12px] text-lll-text-soft">Año</label>
              <input
                className="mt-1 w-[120px] px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">Mes</label>
              <select
                className="mt-1 min-w-[220px] px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none"
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

            <p className="md:ml-2 text-[12px] text-lll-text-soft">
              Período: <span className="text-lll-text">{rangeLabel}</span>
              <span className="ml-2 text-lll-text-soft">
                · vacAt: <span className="text-lll-text">{periodAtISO}</span>
              </span>
              {vacLoading ? (
                <span className="ml-2 text-lll-text-soft">· (vacaciones cargando…)</span>
              ) : null}
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-lll-accent text-black font-semibold disabled:opacity-40"
              disabled={!exportRows.length}
              onClick={() => {
                if (!exportRows.length) return;
                downloadCSV(
                  `balances_${targetUserId}_${year}_${month0 === "all" ? "all" : month0 + 1}.csv`,
                  toCSV(exportRows)
                );
              }}
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft overflow-hidden">
            <div className="sticky top-0 z-10 bg-lll-bg-soft/95 backdrop-blur border-b border-lll-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Políticas</p>
                  <p className="text-[12px] text-lll-text-soft truncate">
                    Tocá una para ver el detalle
                  </p>
                </div>

                <label className="flex items-center gap-2 text-[12px] text-lll-text-soft shrink-0">
                  <input
                    type="checkbox"
                    className="accent-[color:var(--lll-accent)]"
                    checked={showAll}
                    onChange={(e) => setShowAll(e.target.checked)}
                  />
                  Mostrar todas
                </label>
              </div>

              <div className="mt-3">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar política…"
                  className="w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                />
                <p className="mt-2 text-[12px] text-lll-text-soft">
                  {filteredStatsList.length} visible(s)
                  {hiddenCount > 0 ? ` · ${hiddenCount} oculta(s)` : ""}
                </p>
                {!showAll && !q.trim() && (
                  <p className="mt-1 text-[11px] text-lll-text-soft">
                    Mostrando solo con cupo y disponible &gt; 0.
                  </p>
                )}
              </div>
            </div>

            <div className="p-3 max-h-[70vh] overflow-y-auto space-y-3">
              {filteredStatsList.map((s) => {
                const active = selectedKey === s.balanceKey;
                const unit = fmtUnit(s.unit);

                return (
                  <button
                    key={s.balanceKey}
                    type="button"
                    onClick={() => setSelectedKey(s.balanceKey)}
                    className={`w-full text-left rounded-2xl border p-4 transition ${
                      active
                        ? "border-lll-accent/60 bg-lll-accent-soft"
                        : "border-lll-border bg-lll-bg-soft hover:bg-lll-bg-softer"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{s.label}</p>

                        {/* 👇 Para vacaciones mostramos 2 conceptos:
                            - Total acumulado (lo que usa el gráfico)
                            - Cupo anual por antigüedad (informativo) */}
                        {showVacInfo(s.balanceKey) ? (
                          <div className="mt-1 text-[12px] text-lll-text-soft space-y-0.5">
                            <div>
                              Total acumulado:{" "}
                              <span className="text-lll-text font-semibold">
                                {s.allowance == null ? "—" : `${s.allowance}${unit}`}
                              </span>
                            </div>
                            <div>
                              Cupo anual (antigüedad):{" "}
                              <span className="text-lll-text font-semibold">
                                {vacAnnualEntitlement == null ? "—" : `${vacAnnualEntitlement}${unit}`}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 text-[12px] text-lll-text-soft">
                            Cupo: {s.allowance == null ? "—" : `${s.allowance}${unit}`}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-lll-text-soft">Disponible</p>
                        <p className="text-xl font-bold leading-none">
                          {s.available == null ? "—" : s.available}
                          {s.allowance == null ? null : (
                            <span className="ml-1 text-[12px] font-semibold text-lll-text-soft">
                              {unit}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Bar usa el total acumulado (allowance = granted) */}
                    <BalanceBar
                      used={s.used}
                      reserved={s.reserved}
                      available={s.available}
                      allowance={s.allowance}
                      unit={s.unit}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Detalle</p>
                  <p className="mt-1 text-lg font-bold truncate">{selected.label}</p>

                  {showVacInfo(selected.balanceKey) ? (
                    <div className="mt-1 text-[12px] text-lll-text-soft space-y-0.5">
                      <div>
                        Total acumulado (para el gráfico):{" "}
                        <span className="text-lll-text font-semibold">
                          {selected.allowance == null
                            ? "—"
                            : `${selected.allowance}${fmtUnit(selected.unit)}`}
                        </span>
                      </div>
                      <div>
                        Cupo anual (antigüedad):{" "}
                        <span className="text-lll-text font-semibold">
                          {vacAnnualEntitlement == null
                            ? "—"
                            : `${vacAnnualEntitlement}${fmtUnit(selected.unit)}`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-[12px] text-lll-text-soft">
                      Unidad: {fmtUnit(selected.unit)} · Cupo:{" "}
                      {selected.allowance == null
                        ? "—"
                        : `${selected.allowance}${fmtUnit(selected.unit)}`}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
                  <div className="rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2">
                    <p className="text-[11px] text-lll-text-soft">Disponible</p>
                    <p className="text-lg font-bold">
                      {selected.available == null
                        ? "—"
                        : `${selected.available}${fmtUnit(selected.unit)}`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2">
                    <p className="text-[11px] text-lll-text-soft">Usado</p>
                    <p className="text-lg font-bold">
                      {selected.used}
                      {fmtUnit(selected.unit)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2">
                    <p className="text-[11px] text-lll-text-soft">Reservado</p>
                    <p className="text-lg font-bold">
                      {selected.reserved}
                      {fmtUnit(selected.unit)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <BalanceDonut
                  used={selected.used}
                  reserved={selected.reserved}
                  available={selected.available}
                  allowance={selected.allowance}
                  unit={selected.unit}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
              Seleccioná una política para ver el detalle.
            </div>
          )}

          {/* Historial */}
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Historial</p>
              <p className="text-[12px] text-lll-text-soft">Incluye aprobadas + pendientes</p>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[12px] text-lll-text-soft">
                  <tr className="border-b border-lll-border">
                    <th className="py-2 text-left">Desde</th>
                    <th className="py-2 text-left">Hasta</th>
                    <th className="py-2 text-left">Tipo</th>
                    <th className="py-2 text-left">Estado</th>
                    <th className="py-2 text-left">Balance</th>
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
                        {r.amount} {fmtUnit(r.unit as PolicyUnit)}
                      </td>
                    </tr>
                  ))}

                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-[12px] text-lll-text-soft">
                        No hay movimientos en este período 📭
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {!startDateISO ? (
            <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 text-[12px] text-lll-text-soft">
              Nota: este empleado no tiene <code>start_date</code> cargado; la antigüedad no se puede
              calcular para mostrar el cupo anual.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}