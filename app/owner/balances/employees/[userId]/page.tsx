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
    if (!userId) return null;
    return people.find((p) => p.id === userId) ?? null;
  }, [people, userId]);

  const startDateISO = selectedPerson?.start_date ?? null;

  return (
    <UserLayout
      mode="owner"
      header={{
        title: "Balance de colaborador",
        subtitle: "Cupos, usados, reservados e historial.",
      }}
    >
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

          <div className="w-full md:w-[420px]">
            <label className="text-[12px] text-lll-text-soft">Cambiar colaborador</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              value={userId ?? ""}
              disabled={loadingPeople || !people.length}
              onChange={(e) => {
                const nextId = e.target.value;
                if (!nextId) return;
                router.push(`/owner/balances/employees/${nextId}`);
              }}
            >
              {!userId && <option value="">Seleccioná…</option>}
              {loadingPeople && userId ? <option value={userId}>Cargando…</option> : null}
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

      <div className="mt-4">
        {userId ? (
          <BalancesView targetUserId={userId} startDateISO={startDateISO} />
        ) : (
          <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 text-[12px] text-lll-text-soft">
            No se encontró el colaborador.
          </div>
        )}
      </div>
    </UserLayout>
  );
}