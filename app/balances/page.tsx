"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import BalanceDonut from "@/components/balances/BalanceDonut";
import BalanceBar from "@/components/balances/BalanceBar";
import BalancesSkeleton from "@/components/balances/BalancesSkeleton";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField, formControlClassName } from "@/components/ui/FormField";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { SearchField } from "@/components/ui/SearchField";
import { SectionCard } from "@/components/ui/SectionCard";

import { useAbsences } from "@/contexts/AbsencesContext";
import { useAuth } from "@/contexts/AuthContext";

import { computeBalanceStatsByKey, buildHistoryRows } from "@/lib/balances/stats";
import { POLICIES, type BalanceKey, type PolicyUnit } from "@/lib/absencePolicies";
import { getAbsenceTypeLabel } from "@/lib/absenceTypes";

import { supabase } from "@/lib/supabase/client";
import {
  fetchVacationPolicySettings,
  getCachedVacationPolicySettings,
  normalizeVacationPolicyMode,
  type VacationPolicyMode,
} from "@/lib/supabase/vacationPolicy";
import { formatSeniority } from "@/lib/vacations/seniority";

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

function toCSV(rows: Record<string, unknown>[]) {
  const esc = (value: unknown) => {
    const s = String(value ?? "");
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
  // último día del mes
  return new Date(year, month0 + 1, 0);
}

function toISODate(d: Date) {
  // YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

type SelfVacationBalance = {
  granted: number;
  used: number;
  reserved: number;
  reservedPending: number;
  available: number;
};

const selfVacationBalanceCache = new Map<string, SelfVacationBalance>();

type BalancePeriod = number | "toDate" | "all";

function cutoffForYear(year: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  if (year < currentYear) return `${year}-12-31`;
  if (year > currentYear) return toISODate(endOfMonth(year, 0));
  return toISODate(endOfMonth(year, now.getMonth()));
}

function clampAbsencesThrough<T extends { from: string; to: string }>(items: T[], maxISO: string): T[] {
  return items
    .filter((a) => a.from <= maxISO)
    .map((a) => (a.to > maxISO ? { ...a, to: maxISO } : a));
}

function visibleMonthIndexes(year: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  if (year < currentYear) return Array.from({ length: 12 }, (_, i) => i);
  if (year > currentYear) return [];
  return Array.from({ length: now.getMonth() + 1 }, (_, i) => i);
}

export default function BalancesPage() {
  const router = useRouter();
  const { userId, isAuthed, isLoading } = useAuth();
  const { absences, loadMyAbsences, hasLoadedMyAbsences } = useAbsences();

  const vacRequestKeyRef = useRef<string | null>(null);
  const absencesLoaded = userId ? hasLoadedMyAbsences(userId) : false;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthed || !userId) {
      router.replace("/login");
      return;
    }
    void loadMyAbsences(userId);
  }, [isLoading, isAuthed, userId, router, loadMyAbsences]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState<BalancePeriod>("toDate");
  const [selectedKey, setSelectedKey] = useState<BalanceKey | null>(null);

  // ✅ UI: buscador + toggle
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [startDateISO, setStartDateISO] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthed || !userId) return;

    let alive = true;

    supabase
      .from("profiles")
      .select("start_date")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error("profile start_date error", error);
          setStartDateISO(null);
          return;
        }
        setStartDateISO(data?.start_date ?? null);
      });

    return () => {
      alive = false;
    };
  }, [isAuthed, userId]);

  const myAbsences = useMemo(() => {
    if (!userId) return [];
    return absences.filter((a) => a.userId === userId);
  }, [absences, userId]);

  // ✅ vacAt desde URL (para testear): /balances?vacAt=YYYY-MM-DD
  const [vacAtFromUrl, setVacAtFromUrl] = useState<string | null>(null);
  const cachedVacationPolicy = getCachedVacationPolicySettings();
  const [vacModel, setVacModel] = useState<VacationPolicyMode>(
    cachedVacationPolicy?.policy_mode ?? "anniversary"
  );
  const [vacModelReady, setVacModelReady] = useState(
    cachedVacationPolicy !== null
  );

  useEffect(() => {
    if (!isAuthed) return;

    let alive = true;

    (async () => {
      const sp = new URLSearchParams(window.location.search);
      const at = (sp.get("vacAt") ?? "").trim();
      const v = (sp.get("vacModel") ?? sp.get("vacMode") ?? "").trim().toLowerCase();

      if (!alive) return;
      setVacAtFromUrl(at || null);

      if (v === "october" || v === "anniversary") {
        if (alive) {
          setVacModel(normalizeVacationPolicyMode(v));
          setVacModelReady(true);
        }
        return;
      }

      try {
        const policy = await fetchVacationPolicySettings();
        if (alive) {
          setVacModel(policy.policy_mode);
          setVacModelReady(true);
        }
      } catch (e) {
        console.error("fetchVacationPolicySettings error", e);
        if (alive) {
          setVacModel("anniversary");
          setVacModelReady(true);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthed]);

  // ✅ fecha de evaluación de vacaciones según el período elegido
  const periodAtISO = useMemo(() => {
    if (vacAtFromUrl) return vacAtFromUrl;
    if (month0 === "toDate") return cutoffForYear(year);
    if (month0 === "all") return `${year}-12-31`;
    return toISODate(endOfMonth(year, month0));
  }, [vacAtFromUrl, year, month0]);

  const balanceAsOfISO = useMemo(() => vacAtFromUrl ?? toISODate(new Date()), [vacAtFromUrl]);

  // ✅ balance vacaciones REAL (RPC) para que respete migración + acumulado
  const initialVacRequestKey = `${userId ?? "anonymous"}:${periodAtISO}:${vacModel}`;
  const [vacRpc, setVacRpc] = useState<SelfVacationBalance | null>(
    () => selfVacationBalanceCache.get(initialVacRequestKey) ?? null
  );
  const [vacRpcLoading, setVacRpcLoading] = useState(
    () => !selfVacationBalanceCache.has(initialVacRequestKey)
  );
  const [vacRpcResolved, setVacRpcResolved] = useState(
    () => selfVacationBalanceCache.has(initialVacRequestKey)
  );

  useEffect(() => {
    if (!isAuthed || !userId || !vacModelReady) return;

    const requestKey = `${userId}:${periodAtISO}:${vacModel}`;
    if (vacRequestKeyRef.current === requestKey) return;
    vacRequestKeyRef.current = requestKey;

    const cached = selfVacationBalanceCache.get(requestKey) ?? null;
    setVacRpc(cached);
    setVacRpcResolved(cached !== null);

    (async () => {
      try {
        setVacRpcLoading(cached === null);
        const { data, error } =
          vacModel === "october"
            ? await supabase.rpc("get_vacation_balance_october_preview_for_user_at", {
                p_user_id: userId,
                p_at: periodAtISO,
              })
            : await supabase.rpc("get_my_vacation_balance_at", {
                p_at: periodAtISO,
              });

        if (error) throw error;

        const nextBalance: SelfVacationBalance = {
          granted: Number(data?.granted ?? 0),
          used: Number(data?.used ?? 0),
          reserved: Number(data?.reserved ?? 0),
          reservedPending: Number(data?.reserved_pending ?? 0),
          available: Number(data?.available ?? 0),
        };
        selfVacationBalanceCache.set(requestKey, nextBalance);
        setVacRpc(nextBalance);
      } catch (e) {
        console.error("VAC RPC error", e);
        if (!cached) setVacRpc(null);
      } finally {
        setVacRpcLoading(false);
        setVacRpcResolved(true);
      }
    })();
  }, [isAuthed, userId, periodAtISO, vacModel, vacModelReady]);

  const statsMap = useMemo(() => {
    const scopedAbsences = myAbsences;
    const map = computeBalanceStatsByKey(
      scopedAbsences,
      year,
      typeof month0 === "number" ? month0 : undefined,
      {
        asOfISO: balanceAsOfISO,
        homeOfficeCycleStartMonth: vacModel === "october" ? 10 : undefined,
      }
    );

    // ✅ reemplaza cálculo local por RPC (migración + acumulado)
    if (vacRpc) {
      map.set("VACATION_DAYS", {
        balanceKey: "VACATION_DAYS",
        unit: "day",
        allowance: vacRpc.granted,
        used: vacRpc.used,
        reserved: vacRpc.reserved + vacRpc.reservedPending,
        available: vacRpc.available,
      });
    }

    return map;
  }, [myAbsences, year, month0, balanceAsOfISO, vacModel, vacRpc]);

  const breakdownCatalog = useMemo(() => {
    const rows = POLICIES.filter((p) => p.deducts && p.deductsFrom).map((p) => ({
      balanceKey: p.deductsFrom as BalanceKey,
      unit: p.unit as PolicyUnit,
      allowance: p.allowance ?? null,
      label:
        p.type === "licencia"
          ? getAbsenceTypeLabel("licencia", p.subtype ?? null)
          : getAbsenceTypeLabel(
              p.type as Parameters<typeof getAbsenceTypeLabel>[0]
            ),
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

    // UX: primero con cupo; luego alfabético
    return list.sort((a, b) => {
      if (a.balanceKey === "VACATION_DAYS") return -1;
      if (b.balanceKey === "VACATION_DAYS") return 1;
      const aHas = a.allowance != null ? 0 : 1;
      const bHas = b.allowance != null ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.label.localeCompare(b.label);
    });
  }, [breakdownCatalog, statsMap]);

  const seniorityLabel = useMemo(
    () => formatSeniority(startDateISO, periodAtISO),
    [startDateISO, periodAtISO]
  );

  const history = useMemo(() => {
    const scopedAbsences =
      month0 === "toDate" ? clampAbsencesThrough(myAbsences, periodAtISO) : myAbsences;
    return buildHistoryRows(
      scopedAbsences,
      year,
      typeof month0 === "number" ? month0 : undefined,
      {
        asOfISO: periodAtISO,
        homeOfficeCycleStartMonth: vacModel === "october" ? 10 : undefined,
      }
    );
  }, [myAbsences, year, month0, periodAtISO, vacModel]);

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

  const rangeLabel =
    month0 === "toDate"
      ? `Hasta ${monthLabel(year, new Date(periodAtISO + "T00:00:00").getMonth())}`
      : month0 === "all"
        ? `Año ${year} (proyección)`
        : monthLabel(year, month0);

  // ✅ FILTRO AGRESIVO:
  // - si hay búsqueda: mostramos todo (respeta intención del usuario)
  // - si no hay búsqueda y showAll OFF: ocultamos sin cupo y disponible 0
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
    if (query) return 0; // no ocultamos cuando busca
    if (showAll) return 0;

    // ocultas = total - visibles (con regla agresiva)
    return Math.max(0, statsList.length - filteredStatsList.length);
  }, [statsList.length, filteredStatsList.length, q, showAll]);

  const visibleMonths = useMemo(() => visibleMonthIndexes(year), [year]);

  useEffect(() => {
    if (typeof month0 === "number" && !visibleMonths.includes(month0)) {
      setMonth0("toDate");
    }
  }, [month0, visibleMonths]);

  // ✅ Selección consistente con el filtro
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
    if (!stillThere) {
      setSelectedKey(filteredStatsList[0].balanceKey);
    }
  }, [selectedKey, filteredStatsList]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    // detalle desde catálogo completo, aunque esté oculto por filtro
    return statsList.find((x) => x.balanceKey === selectedKey) ?? null;
  }, [selectedKey, statsList]);

  const balancesReady = absencesLoaded && vacRpcResolved;

  return (
    <UserLayout
      mode="user"
      header={{ title: "Balances", subtitle: "Cupos, usados, reservados (pendientes) e historial." }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon tone="text-emerald-300">
              <AppIcon name="balance" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Mis balances"
          subtitle="Consultá tus cupos, consumos y movimientos del período."
          meta={
            balancesReady ? (
              <>
                <SummaryChip>{rangeLabel}</SummaryChip>
                <SummaryChip>{statsList.length} políticas</SummaryChip>
                <SummaryChip>
                  Modelo {vacModel === "october" ? "octubre" : "aniversario"}
                </SummaryChip>
              </>
            ) : (
              <SummaryChip>Cargando balances…</SummaryChip>
            )
          }
          actions={
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-lll-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={vacRpcLoading || !exportRows.length}
              onClick={() => {
                if (!exportRows.length) return;
                downloadCSV(
                  `balances_${year}_${typeof month0 === "number" ? month0 + 1 : month0}.csv`,
                  toCSV(exportRows)
                );
              }}
            >
              <AppIcon name="arrowRight" className="h-4 w-4 rotate-90" />
              Exportar CSV
            </button>
          }
        />

        <SectionCard
          title="Período del informe"
          description="Ajustá el corte para recalcular métricas e historial."
          icon={<AppIcon name="calendar" className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[160px_260px_1fr]">
            <FormField label="Año">
              <input
                className={formControlClassName}
                type="number"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              />
            </FormField>

            <FormField label="Mes">
              <select
                className={formControlClassName}
                value={month0}
                onChange={(event) => {
                  const value = event.target.value;
                  setMonth0(value === "toDate" ? value : Number(value));
                }}
              >
                <option value="toDate">Hasta mes actual</option>
                {visibleMonths.map((monthIndex) => (
                  <option key={monthIndex} value={monthIndex}>
                    {new Date(2020, monthIndex, 1).toLocaleDateString("es-AR", { month: "long" })}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2 text-[12px] text-lll-text-soft">
              Corte de vacaciones: <span className="text-lll-text">{periodAtISO}</span>
              {vacModel === "october" ? (
                <span className="ml-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                  modelo octubre
                </span>
              ) : null}
            </div>
          </div>
        </SectionCard>

      {/* Main */}
        {!balancesReady ? (
        <BalancesSkeleton />
      ) : (
      <div className="lll-fade-in grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Políticas compactas */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft overflow-hidden">
            {/* Header sticky */}
            <div className="sticky top-0 z-10 bg-lll-bg-soft/95 backdrop-blur border-b border-lll-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <AppIcon name="policy" className="h-4 w-4 text-emerald-300" />
                    Políticas
                  </p>
                  <p className="text-[12px] text-lll-text-soft truncate">Tocá una para ver el detalle</p>
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
                <SearchField
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Buscar política…"
                  className="w-full"
                />
                <p className="mt-2 text-[12px] text-lll-text-soft">
                  {filteredStatsList.length} visible(s)
                  {hiddenCount > 0 ? ` · ${hiddenCount} oculta(s)` : ""}
                </p>
                {!showAll && !q.trim() && (
                  <p className="mt-1 text-[11px] text-lll-text-soft">
                    Mostrando solo con cupo y disponible &gt; 0 (para acortar).
                  </p>
                )}
              </div>
            </div>

            {/* Scroll list */}
            <div className="p-3 max-h-[70vh] overflow-y-auto space-y-3">
              {statsList.length === 0 && (
                <div className="rounded-2xl border border-lll-border bg-lll-bg-softer">
                  <EmptyState
                    icon={<AppIcon name="balance" className="h-5 w-5" />}
                    title="Todavía no hay balances"
                    description="Los datos van a aparecer cuando existan políticas o movimientos."
                    className="py-8"
                  />
                </div>
              )}

              {statsList.length > 0 && filteredStatsList.length === 0 && (
                <div className="rounded-2xl border border-lll-border bg-lll-bg-softer">
                  <EmptyState
                    icon={<AppIcon name="search" className="h-5 w-5" />}
                    title="No encontramos políticas"
                    description="Activá Mostrar todas o probá con otro nombre."
                    className="py-8"
                  />
                </div>
              )}

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
                        <p className="mt-1 text-[12px] text-lll-text-soft">
                          Cupo: {s.allowance == null ? "—" : `${s.allowance}${unit}`}
                        </p>
                        {s.balanceKey === "VACATION_DAYS" && seniorityLabel ? (
                          <p className="mt-1 text-[12px] text-lll-text-soft">
                            Antiguedad: <span className="text-lll-text">{seniorityLabel}</span>
                          </p>
                        ) : null}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-lll-text-soft">Disponible</p>
                        <p className="text-[clamp(1.125rem,4vw,1.25rem)] font-bold leading-none">
                          {s.available == null ? "—" : s.available}
                          {s.allowance == null ? null : (
                            <span className="ml-1 text-[12px] font-semibold text-lll-text-soft">
                              {unit}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

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

        {/* Right: detalle + donut + KPIs */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <AppIcon name="balance" className="h-4 w-4 text-emerald-300" />
                    Detalle
                  </p>
                  <p className="mt-1 text-[clamp(1rem,3.5vw,1.125rem)] font-bold leading-tight truncate">{selected.label}</p>
                  <p className="mt-1 text-[12px] text-lll-text-soft">
                    Unidad: {fmtUnit(selected.unit)} · Cupo:{" "}
                    {selected.allowance == null
                      ? "—"
                      : `${selected.allowance}${fmtUnit(selected.unit)}`}
                  </p>
                  {selected.balanceKey === "VACATION_DAYS" && seniorityLabel ? (
                    <p className="mt-1 text-[12px] text-lll-text-soft">
                      Antiguedad: <span className="text-lll-text">{seniorityLabel}</span>
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
                  <div className="rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2">
                    <p className="text-[11px] text-lll-text-soft">Disponible</p>
                    <p className="text-[clamp(1rem,3.5vw,1.125rem)] font-bold leading-tight">
                      {selected.available == null
                        ? "—"
                        : `${selected.available}${fmtUnit(selected.unit)}`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2">
                    <p className="text-[11px] text-lll-text-soft">Usado</p>
                    <p className="text-[clamp(1rem,3.5vw,1.125rem)] font-bold leading-tight">
                      {selected.used}
                      {fmtUnit(selected.unit)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-2">
                    <p className="text-[11px] text-lll-text-soft">Reservado</p>
                    <p className="text-[clamp(1rem,3.5vw,1.125rem)] font-bold leading-tight">
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
            <div className="rounded-2xl border border-lll-border bg-lll-bg-soft">
              <EmptyState
                icon={<AppIcon name="policy" className="h-5 w-5" />}
                title="Seleccioná una política"
                description="El detalle y sus métricas van a aparecer acá."
              />
            </div>
          )}

          {/* Historial */}
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <AppIcon name="clock" className="h-4 w-4 text-emerald-300" />
                Historial
              </p>
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
                        No hay movimientos en este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
        )}
      </div>
    </UserLayout>
  );
}
