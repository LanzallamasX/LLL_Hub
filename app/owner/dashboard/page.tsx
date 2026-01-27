"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import { useAbsences } from "@/contexts/AbsencesContext";
import { useAuth } from "@/contexts/AuthContext";

import { getAbsenceTypeLabel } from "@/lib/absenceTypes";

import { formatAR, formatARDateTime } from "@/lib/date";


// Si tu tipo de ausencia tiene union, esto ayuda a no equivocarnos:
type AbsenceStatus = "pendiente" | "aprobado" | "rechazado";

function statusUI(status: AbsenceStatus) {
  switch (status) {
    case "pendiente":
      return {
        label: "Pendiente",
        badge: "bg-amber-500/15 text-amber-200 border-amber-400/30",
      };
    case "aprobado":
      return {
        label: "Aprobado",
        badge: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
      };
    case "rechazado":
      return {
        label: "Rechazado",
        badge: "bg-red-500/15 text-red-200 border-red-400/30",
      };
  }
}

export default function OwnerDashboardPage() {
  const router = useRouter();
  const { userId, isAuthed, role, isLoading } = useAuth();

  const { absences, pendingCount, loadAllAbsences, setAbsenceStatus } =
    useAbsences();

  const [filter, setFilter] = useState<"pendiente" | "todas">("pendiente");
  const [query, setQuery] = useState("");

  // ✅ Evita doble load en dev (StrictMode)
  const didLoad = useRef(false);

  // Busy por item para evitar doble click
  const [busyId, setBusyId] = useState<string | null>(null);

  // Redirects
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthed || !userId) {
      router.replace("/login");
      return;
    }

    if (role !== "owner") {
      router.replace("/dashboard");
      return;
    }
  }, [isLoading, isAuthed, userId, role, router]);

  // Cargar ausencias del equipo (solo owner)
  useEffect(() => {
    if (didLoad.current) return;

    if (!isLoading && isAuthed && userId && role === "owner") {
      didLoad.current = true;
      loadAllAbsences();
    }
  }, [isLoading, isAuthed, userId, role, loadAllAbsences]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    let items =
      filter === "todas"
        ? absences
        : absences.filter((a) => a.status === "pendiente");

    if (q) {
      items = items.filter((a) => {
        const name = (a.userName ?? "").toLowerCase();
        // Si userName a veces es email, esto igual ayuda
        return name.includes(q);
      });
    }

    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [absences, filter, query]);

  async function changeStatus(id: string, next: AbsenceStatus, current: AbsenceStatus) {
    // Confirmación solo para acciones negativas (rechazar)
    if (next === "rechazado" && current === "pendiente") {
      const ok = window.confirm("¿Confirmás que querés rechazar esta solicitud?");
      if (!ok) return;
    }

    try {
      setBusyId(id);
      await Promise.resolve(setAbsenceStatus(id, next));
    } finally {
      setBusyId(null);
    }
  }

  // Gates
  if (isLoading) {
    return (
      <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center">
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
          Cargando sesión…
        </div>
      </div>
    );
  }

  if (!isAuthed || !userId) {
    return (
      <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center">
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
          Redirigiendo a login…
        </div>
      </div>
    );
  }

  if (role !== "owner") {
    return (
      <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center">
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
          Redirigiendo…
        </div>
      </div>
    );
  }

  return (
    <UserLayout mode="owner">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Solicitudes del equipo</h1>
          <p className="mt-1 text-sm text-lll-text-soft">
            Revisá y gestioná las solicitudes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("pendiente")}
            className={`px-3 py-2 rounded-lg text-sm border ${
              filter === "pendiente"
                ? "bg-lll-accent-soft border-lll-accent/50 text-lll-text"
                : "bg-lll-bg-soft border-lll-border text-lll-text-soft"
            }`}
            type="button"
          >
            Pendientes ({pendingCount})
          </button>

          <button
            onClick={() => setFilter("todas")}
            className={`px-3 py-2 rounded-lg text-sm border ${
              filter === "todas"
                ? "bg-lll-accent-soft border-lll-accent/50 text-lll-text"
                : "bg-lll-bg-soft border-lll-border text-lll-text-soft"
            }`}
            type="button"
          >
            Todas
          </button>
        </div>
      </div>

      {/* Controles */}
      <div className="mt-6 rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">Buscar empleado</p>
            <p className="text-[12px] text-lll-text-soft">
              Filtrá por nombre para encontrar solicitudes rápido.
            </p>
          </div>

          <div className="w-full md:w-[340px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              placeholder="Ej: Patricio, Juan..."
              type="text"
            />
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="mt-6 space-y-4">
        {visibleItems.length === 0 && (
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
            No hay solicitudes para mostrar.
          </div>
        )}

        {visibleItems.map((a) => {
          const s = statusUI(a.status as AbsenceStatus);
          const isBusy = busyId === a.id;

          return (
            <div
              key={a.id}
              className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-start gap-3 flex-wrap">
                    <p className="font-semibold truncate">{a.userName}</p>

                    {/* Badge de estado */}
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[12px] font-semibold ${s.badge}`}
                    >
                      {s.label}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-lll-text-soft">
                    {getAbsenceTypeLabel(a.type)} · {formatAR(a.from)} →{" "}
                    {formatAR(a.to)}
                  </p>

                  {a.note && (
                    <p className="mt-1 text-[12px] text-lll-text-soft">
                      “{a.note}”
                    </p>
                  )}

                <p className="mt-2 text-[12px] text-lll-text-soft">
                  Creada: <span className="text-lll-text">{formatARDateTime(a.createdAt)}</span>
                </p>

                {a.status !== "pendiente" && a.decidedAt ? (
                  <p className="mt-1 text-[12px] text-lll-text-soft">
                    Resuelto{" "}
                    {a.decidedByProfile?.fullName || a.decidedByProfile?.email ? (
                      <>
                        por{" "}
                        <span className="text-lll-text">
                          {a.decidedByProfile.fullName ?? a.decidedByProfile.email}
                        </span>{" "}
                      </>
                    ) : null}
                    el <span className="text-lll-text">{formatARDateTime(a.decidedAt)}</span>
                  </p>
                ) : null}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2">
                  {a.status === "pendiente" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => changeStatus(a.id, "aprobado", "pendiente")}
                        disabled={isBusy}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                          isBusy
                            ? "bg-lll-bg-softer border border-lll-border text-lll-text-soft cursor-not-allowed"
                            : "bg-emerald-500 text-black"
                        }`}
                        type="button"
                      >
                        Aprobar
                      </button>

                      <button
                        onClick={() => changeStatus(a.id, "rechazado", "pendiente")}
                        disabled={isBusy}
                        className={`px-3 py-2 rounded-lg text-sm border ${
                          isBusy
                            ? "bg-lll-bg-softer border-lll-border text-lll-text-soft cursor-not-allowed"
                            : "bg-lll-bg-softer border-lll-border text-lll-text"
                        }`}
                        type="button"
                      >
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Estado ya resuelto: no mostramos aprobar/rechazar */}
                      <span className="text-[12px] text-lll-text-soft">
                        Acción tomada
                      </span>

                      {/* Opcional: permitir volver a pendiente */}
                      <button
                        onClick={() =>
                          changeStatus(a.id, "pendiente", a.status as AbsenceStatus)
                        }
                        disabled={isBusy}
                        className={`px-3 py-2 rounded-lg text-sm border ${
                          isBusy
                            ? "bg-lll-bg-softer border-lll-border text-lll-text-soft cursor-not-allowed"
                            : "bg-lll-bg-softer border-lll-border text-lll-text"
                        }`}
                        type="button"
                      >
                        Marcar pendiente
                      </button>
                    </div>
                  )}


                  {a.status !== "pendiente" && a.decidedAt ? (
                    <p className="mt-2 text-[12px] text-lll-text-soft">
                      Resuelto{" "}
                      {a.decidedByProfile?.fullName || a.decidedByProfile?.email ? (
                        <>
                          por{" "}
                          <span className="text-lll-text">
                            {a.decidedByProfile.fullName ?? a.decidedByProfile.email}
                          </span>{" "}
                        </>
                      ) : null}
                      el <span className="text-lll-text">{formatARDateTime(a.decidedAt)}</span>
                    </p>
                  ) : null}

                </div>
              </div>
            </div>
          );
        })}
      </div>
    </UserLayout>
  );
}
