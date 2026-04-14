// app/absences/AbsencesPageClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import AbsenceList from "@/components/dashboard/AbsenceList";
import NewAbsenceModal, { NewAbsencePayload } from "@/components/modals/NewAbsenceModal";

import { useAbsences } from "@/contexts/AbsencesContext";
import { useAuth } from "@/contexts/AuthContext";

import type { Absence } from "@/lib/supabase/absences";

// para mostrar ausencias usadas
import { computeUsageByBalanceKey } from "@/lib/balances/usage";

// ✅ balance vacaciones desde DB
import { fetchMyVacationBalance, type VacationBalance } from "@/lib/supabase/vacations";

// ✅ adapter shared con Dashboard (evita duplicar lógica)
import { toVacationInfoForModal } from "@/lib/vacations/adapters";

import { useHolidays } from "@/lib/holidays/useHolidays";
import { supabase } from "@/lib/supabase/client";

type Filter = "todas" | "pendiente" | "aprobado" | "rechazado";

function isValidDate(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function yearFromISO(iso?: string | null) {
  if (!iso) return new Date().getFullYear();
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

export default function AbsencesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { userId, email, fullName, isAuthed, isLoading } = useAuth();
  const {
    absences,
    loadMyAbsences,
    createAbsence,
    updateAbsence,
    isLoading: absLoading,
    error: absError,
  } = useAbsences();

  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Absence | null>(null);

  // ✅ Param global para testear políticas (YYYY-MM-DD)
  const asOfParam = searchParams.get("asOf");
  const asOfISO = isValidDate(asOfParam) ? asOfParam : null;

  // ✅ Año “simulado” para feriados y cálculos por año
  const year = useMemo(() => yearFromISO(asOfISO), [asOfISO]);
  const { isoSet: holidaysISO } = useHolidays(year);

  // Evita doble load en dev (StrictMode)
  const didLoad = useRef(false);

  // ✅ Vacaciones DB
  const [vacDb, setVacDb] = useState<VacationBalance | null>(null);
  const [vacDbLoading, setVacDbLoading] = useState(false);

  // ✅ Start date desde profile
  const [startDateISO, setStartDateISO] = useState<string | null>(null);
  const [startDateLoading, setStartDateLoading] = useState(false);

  const currentUser = useMemo(
    () => ({
      userId: userId ?? "",
      userName: fullName ?? email ?? "Usuario",
    }),
    [userId, fullName, email]
  );

  const myAbsences = useMemo(() => {
    if (!userId) return [];
    return absences.filter((a) => a.userId === userId);
  }, [absences, userId]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    let items = myAbsences;
    if (filter !== "todas") items = items.filter((a) => a.status === filter);

    if (q) {
      items = items.filter((a) => {
        const note = (a.note ?? "").toLowerCase();
        const type = (a.type ?? "").toLowerCase();
        return note.includes(q) || type.includes(q);
      });
    }

    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [myAbsences, filter, query]);

  // ✅ ausencias usadas (si tu helper usa “año”, lo hacemos con el año simulado)
  const usageByKey = useMemo(() => {
    return computeUsageByBalanceKey(myAbsences, year);
  }, [myAbsences, year]);

  // ✅ MISMO criterio que Dashboard, sin duplicación
  const vacationInfoForModal = useMemo(() => {
    return toVacationInfoForModal(vacDb);
  }, [vacDb]);

  // ---------------------------------------------
  // ✅ Refresh centralizado (se re-ejecuta al cambiar asOfISO)
  // ---------------------------------------------
  const refreshAll = useCallback(
    async (opts?: { forceAbsences?: boolean }) => {
      if (!isAuthed || !userId) return;

      // 1) Ausencias
      if (opts?.forceAbsences) {
        await loadMyAbsences(userId);
      } else {
        if (!didLoad.current) {
          didLoad.current = true;
          await loadMyAbsences(userId);
        }
      }

      // 2) start_date (profile)
      setStartDateLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("start_date")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;
        setStartDateISO(data?.start_date ?? null);
      } catch {
        setStartDateISO(null);
      } finally {
        setStartDateLoading(false);
      }

      // 3) Balance vacaciones (según asOfISO)
      setVacDbLoading(true);
      try {
        const b = await fetchMyVacationBalance(asOfISO ?? undefined);
        setVacDb(b);
      } catch {
        setVacDb(null);
      } finally {
        setVacDbLoading(false);
      }
    },
    [isAuthed, userId, loadMyAbsences, asOfISO]
  );

  // Gate de auth + redirect
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthed || !userId) {
      router.replace("/login");
      return;
    }
  }, [isLoading, isAuthed, userId, router]);

  // ✅ Cargar/refresh cuando entra o cambia asOfISO
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthed || !userId) return;

    refreshAll({ forceAbsences: true });
  }, [isLoading, isAuthed, userId, asOfISO, refreshAll]);

  function openCreate() {
    setEditing(null);
    setIsModalOpen(true);
  }

  function openEdit(a: Absence) {
    setEditing(a);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditing(null);
  }

  
async function handleSubmit(payload: NewAbsencePayload) {
  if (editing) {
    if (editing.status !== "pendiente") {
      closeModal();
      return;
    }

    await updateAbsence(editing.id, {
      from: payload.from,
      to: payload.to,
      type: payload.type,
      note: payload.note,
      subtype: payload.subtype ?? null,
      hours: payload.hours ?? null,
    });

    await refreshAll({ forceAbsences: true });
    closeModal();
    return;
  }

  // 👉 CREACIÓN
  await createAbsence({
    userId: currentUser.userId,
    userName: currentUser.userName,
    from: payload.from,
    to: payload.to,
    type: payload.type,
    note: payload.note,
    subtype: payload.subtype ?? null,
    hours: payload.hours ?? null,
  });

  // 🚀 DISPARA EMAIL (no bloquea)
  fetch("/api/process-emails").catch(() => {});

  await refreshAll({ forceAbsences: true });
  closeModal();
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

  return (
    <UserLayout
      mode="user"
      header={{
        title: "Mis ausencias",
        subtitle: "Historial y gestión de tus solicitudes.",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mis ausencias</h1>
          <p className="mt-1 text-sm text-lll-text-soft">
            Creá solicitudes, revisá estados y editá mientras estén pendientes.
          </p>

          {absLoading && <p className="mt-1 text-[12px] text-lll-text-soft">Cargando…</p>}
          {absError && <p className="mt-1 text-[12px] text-red-300">{absError}</p>}
          {vacDbLoading && (
            <p className="mt-1 text-[12px] text-lll-text-soft">Cargando vacaciones…</p>
          )}
          {startDateLoading && (
            <p className="mt-1 text-[12px] text-lll-text-soft">Cargando fecha de ingreso…</p>
          )}

          {asOfISO ? (
            <p className="mt-1 text-[12px] text-amber-300">
              Modo test activo: simulando fecha {asOfISO}
            </p>
          ) : null}
        </div>

        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-lll-accent text-black font-semibold"
          type="button"
        >
          + Nueva solicitud
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {(["todas", "pendiente", "aprobado", "rechazado"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  filter === f
                    ? "bg-lll-accent-soft border-lll-accent/50 text-lll-text"
                    : "bg-lll-bg-soft border-lll-border text-lll-text-soft"
                }`}
              >
                {f === "todas" ? "Todas" : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="w-full lg:w-[360px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              placeholder="Buscar por tipo o nota…"
              type="text"
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <AbsenceList absences={visibleItems} onEdit={openEdit} />
        {visibleItems.length === 0 && (
          <div className="mt-4 rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
            No hay solicitudes para mostrar.
          </div>
        )}
      </div>

      <NewAbsenceModal
        open={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        initial={editing ? { /* ...tu initial actual... */ } : undefined}
        submitLabel={editing ? "Guardar cambios" : "Enviar"}
        title={editing ? "Editar solicitud" : "Nueva solicitud"}
        subtitle={
          editing
            ? "Podés editar mientras esté pendiente."
            : "Completá los datos y enviá la solicitud."
        }
        usageByKey={usageByKey}
        vacationInfo={vacationInfoForModal ?? undefined}
        vacationAvailable={vacationInfoForModal?.available ?? undefined}
        existingAbsences={myAbsences.map((a) => ({
          id: a.id,
          status: a.status,
          from: a.from,
          to: a.to,
        }))}
        ignoreAbsenceId={editing?.id ?? null}
        holidaysISO={holidaysISO}
        startDateISO={startDateISO}
        asOfISO={asOfISO}
      />
    </UserLayout>
  );
}