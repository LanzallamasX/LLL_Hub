"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import UserLayout from "@/components/layout/UserLayout";
import BalancesView from "@/components/balances/BalancesView";

import { useAuth } from "@/contexts/AuthContext";
import { listProfiles, type ProfileRow } from "@/lib/supabase/profilesAdmin";

export default function OwnerEmployeeBalanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;

  const { isLoading, isAuthed, role } = useAuth();

  // Para poder “cambiar de empleado” desde acá:
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [people, setPeople] = useState<ProfileRow[]>([]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthed) {
      router.replace("/login");
      return;
    }
    if (role !== "owner") {
      router.replace("/dashboard");
      return;
    }
  }, [isLoading, isAuthed, role, router]);

  useEffect(() => {
    // cargamos lista para el selector
    (async () => {
      try {
        setLoadingPeople(true);
        const data = await listProfiles();
        setPeople(data ?? []);
      } finally {
        setLoadingPeople(false);
      }
    })();
  }, []);

  const selectedPerson = useMemo(() => {
    return people.find((p) => p.id === userId) ?? null;
  }, [people, userId]);

  const startDateISO = (selectedPerson as any)?.start_date ?? null; 
  // ⚠️ Si tu campo se llama distinto (startDate), avisame y lo ajusto.

  return (
    <UserLayout
      mode="owner"
      header={{
        title: "Balance de empleado",
        subtitle: "Cupos, usados, reservados e historial.",
      }}
    >
      {/* Top actions */}
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/owner/balances/employees"
              className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm hover:bg-lll-bg-softer/70"
            >
              ← Volver
            </Link>

            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {selectedPerson?.full_name ?? "Empleado"}
              </p>
              <p className="text-[12px] text-lll-text-soft truncate">
                {selectedPerson?.email ?? ""}
              </p>
            </div>
          </div>

          {/* Selector para cambiar empleado */}
          <div className="w-full md:w-[420px]">
            <label className="text-[12px] text-lll-text-soft">Cambiar empleado</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              value={userId}
              disabled={loadingPeople || !people.length}
              onChange={(e) => {
                const nextId = e.target.value;
                router.push(`/owner/balances/employees/${nextId}`);
              }}
            >
              {loadingPeople && <option value={userId}>Cargando…</option>}
              {!loadingPeople &&
                people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.full_name ?? "Sin nombre") + (p.email ? ` · ${p.email}` : "")}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Balances */}
      <div className="mt-4">
        {userId ? (
          <BalancesView targetUserId={userId} startDateISO={startDateISO} />
        ) : (
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 text-[12px] text-lll-text-soft">
            No se encontró el empleado.
          </div>
        )}
      </div>
    </UserLayout>
  );
}
