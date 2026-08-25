"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import UserLayout from "@/components/layout/UserLayout";
import BalancesView from "@/components/balances/BalancesView";
import BalancesSkeleton from "@/components/balances/BalancesSkeleton";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { formControlClassName } from "@/components/ui/FormField";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCachedProfiles,
  listProfiles,
  type ProfileRow,
} from "@/lib/supabase/profilesAdmin";

function getInitials(person: ProfileRow | null) {
  const source = person?.full_name?.trim() || person?.email?.trim() || "Empleado";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function OwnerEmployeeBalanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;
  const { isLoading, isAuthed, role } = useAuth();
  const cachedProfiles = getCachedProfiles();

  const [loadingPeople, setLoadingPeople] = useState(cachedProfiles === null);
  const [people, setPeople] = useState<ProfileRow[]>(cachedProfiles ?? []);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthed) {
      router.replace("/login");
      return;
    }
    if (role !== "owner") {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthed, role, router]);

  useEffect(() => {
    (async () => {
      try {
        setLoadingPeople(getCachedProfiles() === null);
        const data = await listProfiles();
        setPeople(data ?? []);
      } finally {
        setLoadingPeople(false);
      }
    })();
  }, []);

  const selectedPerson = useMemo(() => {
    if (!userId) return null;
    return people.find((person) => person.id === userId) ?? null;
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
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            loadingPeople ? (
              <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
            ) : (
              <SummaryIcon tone="text-sky-300">
                <span className="text-lg font-bold">{getInitials(selectedPerson)}</span>
              </SummaryIcon>
            )
          }
          title={
            loadingPeople ? (
              <Skeleton className="h-5 w-44" />
            ) : (
              selectedPerson?.full_name ?? "Empleado"
            )
          }
          subtitle={
            loadingPeople ? (
              <Skeleton className="h-3 w-56" />
            ) : (
              selectedPerson?.email ?? "Sin email registrado"
            )
          }
          meta={
            !loadingPeople ? (
              <>
                <SummaryChip>{selectedPerson?.team || "Sin equipo"}</SummaryChip>
                <SummaryChip>
                  {startDateISO ? `Ingreso: ${startDateISO}` : "Sin fecha de ingreso"}
                </SummaryChip>
              </>
            ) : null
          }
          actions={
            <>
              <Link
                href="/owner/balances/employees"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm text-lll-text-soft transition hover:text-lll-text"
              >
                <AppIcon name="arrowRight" className="h-4 w-4 rotate-180" />
                Volver
              </Link>

              {loadingPeople ? (
                <Skeleton className="h-10 w-72 rounded-lg" />
              ) : (
                <select
                  aria-label="Cambiar colaborador"
                  className={`${formControlClassName} mt-0 w-full sm:w-[320px]`}
                  value={userId ?? ""}
                  disabled={!people.length}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    if (nextId) router.push(`/owner/balances/employees/${nextId}`);
                  }}
                >
                  {!userId ? <option value="">Seleccioná…</option> : null}
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {(person.full_name ?? "Sin nombre") +
                        (person.email ? ` · ${person.email}` : "")}
                    </option>
                  ))}
                </select>
              )}
            </>
          }
        />

        {loadingPeople ? (
          <BalancesSkeleton />
        ) : userId && selectedPerson ? (
          <BalancesView
            targetUserId={userId}
            startDateISO={startDateISO}
            vacationDaysOverride={selectedPerson.vacation_days_override ?? null}
          />
        ) : (
          <section className="rounded-2xl border border-lll-border bg-lll-bg-soft">
            <EmptyState
              icon={<AppIcon name="person" className="h-5 w-5" />}
              title="No encontramos al colaborador"
              description="Volvé al listado y seleccioná otra persona."
              action={
                <Link
                  href="/owner/balances/employees"
                  className="inline-flex items-center gap-2 rounded-lg bg-lll-accent px-4 py-2 text-sm font-semibold text-black"
                >
                  Ver colaboradores
                  <AppIcon name="arrowRight" className="h-4 w-4" />
                </Link>
              }
            />
          </section>
        )}
      </div>
    </UserLayout>
  );
}
