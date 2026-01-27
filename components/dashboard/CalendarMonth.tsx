"use client";

import { useMemo } from "react";
import type { Absence } from "@/lib/supabase/absences";
import { getAbsenceTypeLabel } from "@/lib/absenceTypes";
import { formatAR, toDate00 } from "@/lib/date";

type Props = {
  absences: Absence[];
  viewYear: number;
  viewMonth: number; // 0..11
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  title?: string; // opcional si querés variar entre user/owner
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

function isDateInRange(day: Date, fromISO: string, toISO: string) {
  const from = toDate00(fromISO).getTime();
  const to = toDate00(toISO).getTime();
  const t = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  return t >= from && t <= to;
}

function dayBaseClass() {
  return "relative aspect-square rounded-xl flex items-center justify-center text-sm border transition bg-lll-bg-soft border-lll-border text-lll-text-soft hover:text-lll-text";
}

function dayToneClass(hits: Absence[]) {
  // prioridad por status (si hay varios)
  const hasPending = hits.some((h) => h.status === "pendiente");
  const hasApproved = hits.some((h) => h.status === "aprobado");
  const hasRejected = hits.some((h) => h.status === "rechazado");

  if (hasPending) return "bg-lll-bg-soft border-lll-accent-alt/60 text-lll-text";
  if (hasApproved) return "bg-lll-accent-soft border-lll-accent/60 text-lll-text";
  if (hasRejected) return "bg-lll-bg-softer border-lll-border text-lll-text-soft opacity-80";
  return "";
}

export default function CalendarMonth({
  absences,
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  onToday,
  title = "Calendario",
}: Props) {
  const daysGrid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = mondayFirstIndex(first.getDay()); // 0..6

    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(viewYear, viewMonth, d) });
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [viewYear, viewMonth]);

  return (
    <div className="lg:col-span-2 rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[12px] text-lll-text-soft">
            Vista mensual (hover para ver detalle).
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
        <div className="grid grid-cols-7 gap-2 text-center text-[12px] text-lll-text-soft">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {daysGrid.map((cell, idx) => {
            if (!cell.date) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="aspect-square rounded-xl border border-transparent"
                />
              );
            }

            const hits = absences.filter((a) => isDateInRange(cell.date!, a.from, a.to));

            // tooltip: lista completa (si hay varias)
            const tooltip =
              hits.length === 0
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

            return (
              <button
                key={cell.date.toISOString()}
                type="button"
                className={[
                  dayBaseClass(),
                  hits.length ? dayToneClass(hits) : "",
                ].join(" ")}
                title={tooltip}
              >
                {cell.date.getDate()}

                {/* Indicadores visuales si hay varios */}
                {hits.length > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <div className="flex gap-1">
                      {/* hasta 3 “dots” */}
                      {hits.slice(0, 3).map((_, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-lll-accent-alt opacity-90"
                        />
                      ))}
                    </div>

                    {/* si hay más de 3, mostramos +N */}
                    {hits.length > 3 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-lll-border bg-lll-bg-soft text-lll-text-soft">
                        +{hits.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-lll-text-soft">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-lll-accent-soft border border-lll-accent/60" />
            <span>Aprobado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-lll-bg-soft border border-lll-accent-alt/60" />
            <span>Pendiente</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-lll-bg-softer border border-lll-border opacity-80" />
            <span>Rechazado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
