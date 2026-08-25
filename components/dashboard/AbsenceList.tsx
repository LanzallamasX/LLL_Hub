"use client";

import { useEffect, useState } from "react";

import {
  getAbsenceTypeLabel,
} from "@/lib/absenceTypes";
import { formatAR, formatARDateTime } from "@/lib/date";
import { getAbsenceTimeRangeLabel } from "@/lib/absences/timeRange";


import { useAbsences } from "@/contexts/AbsencesContext";
import AbsenceConversation from "@/components/dashboard/AbsenceConversation";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";

import type { Absence, AbsenceStatus } from "@/lib/supabase/absences";

function statusPill(status: AbsenceStatus) {
  const base =
    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] border font-semibold";

  if (status === "pendiente")
    return `${base} bg-amber-500/15 border-amber-400/30 text-amber-200`;

  if (status === "aprobado")
    return `${base} bg-emerald-500/15 border-emerald-400/30 text-emerald-200`;

  return `${base} bg-red-500/15 border-red-400/30 text-red-200`;
}

function statusLabel(status: AbsenceStatus) {
  if (status === "pendiente") return "Pendiente";
  if (status === "aprobado") return "Aprobado";
  return "Rechazado";
}

export default function AbsenceList({
  absences,
  onEdit,
  focusId = null,
}: {
  absences: Absence[];
  onEdit: (absence: Absence) => void;
  focusId?: string | null;
}) {
  const { deleteAbsence } = useAbsences();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusId || absences.length === 0) return;

    const element = document.getElementById(`absence-${focusId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, absences.length]);

async function onDelete(a: Absence) {
  if (a.status !== "pendiente") return;

  const ok = window.confirm("¿Seguro que querés eliminar esta solicitud?");
  if (!ok) return;

  try {
    setBusyId(a.id);
    await deleteAbsence(a.id);
  } catch (e: unknown) {
    // Evita el crash de Next y muestra un mensaje legible
    const errorDetails = e as { message?: string; error_description?: string } | null;
    const msg =
      errorDetails?.message ??
      errorDetails?.error_description ??
      "No se pudo eliminar la solicitud (posible falta de permisos).";
    console.error("deleteAbsence error:", e);
    alert(msg);
  } finally {
    setBusyId(null);
  }
}

  return (
    <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-lll-border bg-lll-bg-softer text-lll-accent-alt">
            <AppIcon name="absence" className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold">Mis solicitudes</p>
        </div>
        <span className="text-[12px] text-lll-text-soft">{absences.length}</span>
      </div>

      <div className="mt-3 space-y-3">
        {absences.length === 0 ? (
          <div className="rounded-xl border border-lll-border bg-lll-bg-softer">
            <EmptyState
              icon={<AppIcon name="calendar" className="h-5 w-5" />}
              title="No hay solicitudes para mostrar"
              description="Creá una nueva solicitud o cambiá los filtros para ver otros resultados."
            />
          </div>
        ) : null}

        {absences.map((a) => {
          const isBusy = busyId === a.id;
          const timeRangeLabel = getAbsenceTimeRangeLabel(a);

          return (
            <div
              key={a.id}
              id={`absence-${a.id}`}
              className={`rounded-xl border bg-lll-bg-softer p-3 transition ${
                focusId === a.id
                  ? "border-lll-accent shadow-[0_0_0_2px_rgba(255,200,0,0.15)]"
                  : "border-lll-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {getAbsenceTypeLabel(a.type, a.subtype ?? null)}
                  </p>

                  <div className="mt-2 flex items-start gap-2 text-[12px] text-lll-text-soft">
                    <AppIcon name="calendar" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>
                      {formatAR(a.from)} → {formatAR(a.to)}
                      {a.note ? ` · ${a.note}` : ""}
                    </p>
                  </div>

                  {timeRangeLabel ? (
                    <p className="mt-1 flex items-center gap-2 text-[12px] text-lll-text-soft">
                      <AppIcon name="clock" className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-lll-text">{timeRangeLabel}</span>
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={statusPill(a.status)}>
                    <AppIcon
                      name={
                        a.status === "pendiente"
                          ? "clock"
                          : a.status === "aprobado"
                            ? "check"
                            : "close"
                      }
                      className="h-3.5 w-3.5"
                    />
                    {statusLabel(a.status)}
                  </span>

                                  {a.status !== "pendiente" && a.decidedAt ? (
                  <p className="text-[11px] text-lll-text-soft">
                    {statusLabel(a.status)} el {formatARDateTime(a.decidedAt)}
                    {a.decidedByProfile?.fullName || a.decidedByProfile?.email ? (
                      <>
                        {" "}por{" "}
                        <span className="text-lll-text">
                          {a.decidedByProfile.fullName ?? a.decidedByProfile.email}
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : null}
                  

                  {a.status === "pendiente" ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit(a)}
                        disabled={isBusy}
                        className={`px-3 py-1.5 rounded-lg border text-[12px] ${
                          isBusy
                            ? "border-lll-border bg-lll-bg-soft text-lll-text-soft cursor-not-allowed"
                            : "border-lll-border bg-lll-bg-soft text-lll-text-soft hover:text-lll-text"
                        }`}
                        type="button"
                      >
                        <AppIcon name="edit" className="mr-1 inline h-3.5 w-3.5" />
                        Editar
                      </button>

                      <button
                        onClick={() => onDelete(a)}
                        disabled={isBusy}
                        className={`px-3 py-1.5 rounded-lg border text-[12px] ${
                          isBusy
                            ? "border-lll-border bg-lll-bg-soft text-lll-text-soft cursor-not-allowed"
                            : "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                        }`}
                        type="button"
                      >
                        <AppIcon name="trash" className="mr-1 inline h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </div>



              </div>

              <AbsenceConversation absence={a} defaultOpen={focusId === a.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
