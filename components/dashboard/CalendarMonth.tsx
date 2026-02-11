"use client";

import { useMemo, useState } from "react";
import type { Absence } from "@/lib/supabase/absences";
import { getAbsenceTypeLabel } from "@/lib/absenceTypes";
import { formatAR, toDate00 } from "@/lib/date";

type CalendarMode = "owner" | "user";

type Props = {
  absences: Absence[];
  viewYear: number;
  viewMonth: number; // 0..11
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  title?: string;
  mode?: CalendarMode;
};

function mondayFirstIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

function monthLabelES(monthIndex: number) {
  const months = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ];
  return months[monthIndex] ?? "";
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayBaseClass() {
  // ✅ más aire + look más “app calendario”
  return [
    "relative rounded-2xl border transition",
    "bg-lll-bg-soft border-lll-border",
    "hover:bg-lll-bg-softer",
    "p-3 min-h-[118px] w-full", // ✅ más alto
    "text-left",
  ].join(" ");
}

function dayToneClass(hits: Absence[]) {
  const hasPending = hits.some((h) => h.status === "pendiente");
  const hasApproved = hits.some((h) => h.status === "aprobado");

  if (hasPending) return "ring-1 ring-lll-accent-alt/40";
  if (hasApproved) return "ring-1 ring-lll-accent/30";
  return "";
}

function StatusChip({ status }: { status: Absence["status"] }) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4";
  if (status === "aprobado") {
    return (
      <span className={`${base} border-emerald-700/30 bg-emerald-900/20 text-emerald-200`}>
        Aprobada
      </span>
    );
  }
  if (status === "pendiente") {
    return (
      <span className={`${base} border-amber-700/30 bg-amber-900/20 text-amber-200`}>
        Pendiente
      </span>
    );
  }
  return (
    <span className={`${base} border-red-700/30 bg-red-900/20 text-red-200`}>
      Rechazada
    </span>
  );
}

// ✅ Hardcode MVP: luego lo pasamos a DB (absence_types.is_sensitive)
const SENSITIVE_TYPES = new Set<string>([
  "enfermedad",
  "turno_medico",
  "medico",
  "salud",
  "sick",
  "medical",
]);

function isSensitiveType(type: string) {
  return SENSITIVE_TYPES.has(String(type).toLowerCase());
}

export default function CalendarMonth({
  absences,
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  onToday,
  title = "Calendario",
  mode = "owner",
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const daysGrid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = mondayFirstIndex(first.getDay()); // 0..6

    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++)
      cells.push({ date: new Date(viewYear, viewMonth, d) });
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [viewYear, viewMonth]);

  const absencesByDay = useMemo(() => {
    const map = new Map<string, Absence[]>();

    // Regla calendario owner: rechazadas NO van al calendario
    const list =
      mode === "owner"
        ? (absences ?? []).filter((a) => a.status !== "rechazado")
        : (absences ?? []);

    for (const a of list) {
      const from = toDate00(a.from);
      const to = toDate00(a.to);

      // guard anti-loop: 1 año max
      for (let i = 0, cur = new Date(from); i < 370; i++, cur.setDate(cur.getDate() + 1)) {
        if (cur.getTime() > to.getTime()) break;
        const key = dayKey(cur);
        const arr = map.get(key) ?? [];
        arr.push(a);
        map.set(key, arr);
      }
    }

    // Orden: pendientes arriba, luego aprobados
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        if (a.status === b.status) {
          const an = (a.userName ?? "").toLowerCase();
          const bn = (b.userName ?? "").toLowerCase();
          return an.localeCompare(bn);
        }
        if (a.status === "pendiente") return -1;
        if (b.status === "pendiente") return 1;
        return 0;
      });
      map.set(k, arr);
    }

    return map;
  }, [absences, mode]);

  const selectedKey = useMemo(() => {
    if (!selectedDate) return null;
    return dayKey(selectedDate);
  }, [selectedDate]);

  const selectedHits = useMemo(() => {
    if (!selectedKey) return [];
    return absencesByDay.get(selectedKey) ?? [];
  }, [absencesByDay, selectedKey]);

  function openDay(date: Date) {
    setSelectedDate(date);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <div className="rounded-2xl lg:col-span-2 border border-lll-border bg-lll-bg-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[12px] text-lll-text-soft">
            {mode === "owner"
              ? "Vista mensual del equipo. Click en un día para ver detalle."
              : "Vista mensual (hover para ver detalle)."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm hover:opacity-90"
            onClick={onPrevMonth}
            type="button"
          >
            ←
          </button>

          <span className="text-[12px] px-3 py-2 rounded-full border border-lll-border bg-lll-bg-softer text-lll-text-soft">
            {monthLabelES(viewMonth)} {viewYear}
          </span>

          <button
            className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm hover:opacity-90"
            onClick={onNextMonth}
            type="button"
          >
            →
          </button>

          <button
            className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm hover:opacity-90"
            onClick={onToday}
            type="button"
          >
            Hoy
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-lll-border bg-lll-bg-softer p-4">
        <div className="grid grid-cols-7 gap-3 text-center text-[12px] text-lll-text-soft">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-7 gap-3">
          {daysGrid.map((cell, idx) => {
            if (!cell.date) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[118px] rounded-2xl border border-transparent"
                />
              );
            }

            const key = dayKey(cell.date);
            const hits = absencesByDay.get(key) ?? [];

            const total = hits.length;
            const pendingCount = hits.filter((h) => h.status === "pendiente").length;
            const approvedCount = hits.filter((h) => h.status === "aprobado").length;

            // Tooltip: owner minimal
            const tooltip =
              mode === "owner"
                ? cell.date.toLocaleDateString("es-AR")
                : total === 0
                  ? cell.date.toLocaleDateString("es-AR")
                  : [
                      cell.date.toLocaleDateString("es-AR"),
                      "",
                      ...hits.map((a) => {
                        const who = a.userName ? `${a.userName} · ` : "";
                        const typ = getAbsenceTypeLabel(a.type as any);
                        const range = `${formatAR(a.from)} → ${formatAR(a.to)}`;
                        return `• ${who}${typ} (${a.status}) — ${range}`;
                      }),
                    ].join("\n");

            // ✅ resumen robusto para 1..N ausencias
            const firstName = hits[0]?.userName ?? "—";
            const summaryLine =
              total <= 1 ? firstName : `${firstName} +${total - 1}`;

            return (
              <button
                key={cell.date.toISOString()}
                type="button"
                className={[dayBaseClass(), total ? dayToneClass(hits) : ""].join(" ")}
                title={tooltip}
                onClick={() => {
                  if (mode === "owner") openDay(cell.date!);
                }}
              >
                {/* day number */}
                <div className="absolute top-3 right-3 text-[12px] text-lll-text-soft">
                  {cell.date.getDate()}
                </div>

                {/* badges */}
                {total > 0 ? (
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-lll-border bg-lll-bg text-lll-text">
                      {total}
                    </span>
                    {pendingCount > 0 ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-700/30 bg-amber-900/20 text-amber-200">
                        {pendingCount}P
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {/* content */}
                {total > 0 ? (
                  <div className="mt-10 pr-2">
                    <div className="text-[12px] font-medium text-lll-text truncate">
                      {summaryLine}
                    </div>
                    <div className="mt-1 text-[11px] text-lll-text-soft/70">
                      {total} out
                    </div>
                  </div>
                ) : (
                  <div className="mt-10 text-[11px] text-lll-text-soft/40">—</div>
                )}

                {/* mini bar */}
                {total > 0 ? (
                  <div className="absolute left-3 right-3 bottom-2 h-1.5 rounded-full overflow-hidden border border-lll-border bg-lll-bg">
                    <div
                      className="h-full bg-amber-500/70"
                      style={{ width: `${Math.round((pendingCount / total) * 100)}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500/70"
                      style={{ width: `${Math.round((approvedCount / total) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-lll-text-soft">
          <div className="flex items-center gap-2">
            <span className="h-2 w-8 rounded-full overflow-hidden border border-lll-border bg-lll-bg">
              <span className="block h-full w-full bg-emerald-500/70" />
            </span>
            <span>Aprobado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-8 rounded-full overflow-hidden border border-lll-border bg-lll-bg">
              <span className="block h-full w-full bg-amber-500/70" />
            </span>
            <span>Pendiente</span>
          </div>
          {mode !== "owner" ? (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-lll-bg-softer border border-lll-border opacity-80" />
              <span>Rechazado</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Drawer owner */}
{/* Modal detalle del día (owner) */}
{mode === "owner" && drawerOpen ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    {/* overlay */}
    <button
      aria-label="Cerrar"
      className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      onClick={closeDrawer}
      type="button"
    />

    {/* panel */}
    <div className="relative w-full max-w-lg rounded-2xl border border-lll-border bg-lll-bg shadow-2xl">
      {/* header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-lll-border">
        <div>
          <div className="text-sm font-semibold text-lll-text">
            {selectedDate
              ? selectedDate.toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "Día"}
          </div>
          <div className="text-xs text-lll-text-soft">
            {selectedHits.length} ausencia{selectedHits.length === 1 ? "" : "s"}
          </div>
        </div>

        <button
          onClick={closeDrawer}
          className="rounded-xl border border-lll-border bg-lll-bg-softer px-3 py-1.5 text-xs text-lll-text hover:bg-lll-bg-soft"
          type="button"
        >
          Cerrar
        </button>
      </div>

      {/* body */}
      <div className="p-4">
        {selectedHits.length === 0 ? (
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 text-sm text-lll-text-soft">
            No hay ausencias para este día.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto space-y-2 pr-1">
            {selectedHits.map((a) => {
              const rawLabel = getAbsenceTypeLabel(a.type as any);
              const safeLabel = isSensitiveType(String(a.type)) ? "Ausencia" : rawLabel;

              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-lll-border bg-lll-bg-soft p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-lll-text truncate">
                        {a.userName ?? "Sin nombre"}
                      </div>
                      <div className="mt-0.5 text-xs text-lll-text-soft truncate">
                        {safeLabel}
                      </div>
                    </div>

                    <StatusChip status={a.status} />
                  </div>

                  <div className="mt-2 text-[11px] text-lll-text-soft">
                    {formatAR(a.from)} → {formatAR(a.to)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* footer (opcional) */}
      <div className="flex items-center justify-between gap-2 p-4 border-t border-lll-border">
        <div className="text-[11px] text-lll-text-soft">
          Tip: Click en otro día para cambiar.
        </div>
        {/* Si querés CTA real, lo conectamos después */}
        {/* <button className="rounded-xl bg-lll-accent px-3 py-2 text-xs text-black">Ver solicitudes</button> */}
      </div>
    </div>
  </div>
) : null}

    </div>
  );
}
