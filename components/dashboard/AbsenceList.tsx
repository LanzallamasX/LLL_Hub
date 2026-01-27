"use client";

import { useState } from "react";

import {
  getAbsenceType,
  getAbsenceTypeLabel,
  getAbsenceTypeToneClasses,
} from "@/lib/absenceTypes";
import { formatAR, formatARDateTime } from "@/lib/date";


import { useAbsences } from "@/contexts/AbsencesContext";

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
}: {
  absences: Absence[];
  onEdit: (absence: Absence) => void;
}) {
  const { deleteAbsence } = useAbsences();
  const [busyId, setBusyId] = useState<string | null>(null);

async function onDelete(a: Absence) {
  if (a.status !== "pendiente") return;

  const ok = window.confirm("¿Seguro que querés eliminar esta solicitud?");
  if (!ok) return;

  try {
    setBusyId(a.id);
    await deleteAbsence(a.id);
  } catch (e: any) {
    // Evita el crash de Next y muestra un mensaje legible
    const msg =
      e?.message ??
      e?.error_description ??
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
        <p className="text-sm font-semibold">Mis solicitudes</p>
        <span className="text-[12px] text-lll-text-soft">{absences.length}</span>
      </div>

      <div className="mt-3 space-y-3">
        {absences.length === 0 ? (
          <div className="rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-[12px] text-lll-text-soft">
            Todavía no tenés solicitudes. Usá <span className="text-lll-text">“Nueva solicitud”</span> para crear la primera.
          </div>
        ) : null}

        {absences.map((a) => {
          const def = getAbsenceType(a.type);
          const cls = getAbsenceTypeToneClasses(def?.tone ?? "neutral");
          const isBusy = busyId === a.id;

          return (
            <div
              key={a.id}
              className="rounded-xl border border-lll-border bg-lll-bg-softer p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {getAbsenceTypeLabel(a.type)}
                  </p>

                  <p className="mt-2 text-[12px] text-lll-text-soft">
                    {formatAR(a.from)} → {formatAR(a.to)}
                    {a.note ? ` · ${a.note}` : ""}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className={statusPill(a.status)}>
                    <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
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
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </div>



              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
