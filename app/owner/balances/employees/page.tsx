"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/LoadingSkeletons";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { SearchField } from "@/components/ui/SearchField";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCachedProfiles,
  listProfiles,
  type ProfileRow,
} from "@/lib/supabase/profilesAdmin";

function getInitials(person: ProfileRow) {
  const source = person.full_name?.trim() || person.email?.trim() || "Usuario";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function OwnerBalancesEmployeesPage() {
  const router = useRouter();
  const { isLoading, isAuthed, role } = useAuth();
  const cachedProfiles = getCachedProfiles();

  const [loading, setLoading] = useState(cachedProfiles === null);
  const [rows, setRows] = useState<ProfileRow[]>(cachedProfiles ?? []);
  const [query, setQuery] = useState("");

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

    (async () => {
      try {
        setLoading(getCachedProfiles() === null);
        const data = await listProfiles();
        setRows(data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoading, isAuthed, role, router]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rows;

    return rows.filter((person) => {
      const name = (person.full_name ?? "").toLowerCase();
      const email = (person.email ?? "").toLowerCase();
      const team = (person.team ?? "").toLowerCase();
      return (
        name.includes(normalizedQuery) ||
        email.includes(normalizedQuery) ||
        team.includes(normalizedQuery)
      );
    });
  }, [rows, query]);

  return (
    <UserLayout
      mode="owner"
      header={{
        title: "Balances por colaborador",
        subtitle: "Elegí una persona para ver su balance y su historial.",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon tone="text-sky-300">
              <AppIcon name="balance" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Balance anual por colaborador"
          subtitle="Consultá cupos, consumos e historial individual."
          meta={
            <>
              <SummaryChip>{rows.length} colaboradores</SummaryChip>
              <SummaryChip>{filtered.length} visibles</SummaryChip>
            </>
          }
        />

        <SectionCard
          title="Colaboradores"
          description="Seleccioná una persona para abrir el detalle completo."
          icon={<AppIcon name="users" className="h-4 w-4" />}
          action={
            <SearchField
              className="w-[min(420px,46vw)] max-w-full"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, email o equipo…"
            />
          }
        >
          <div className="overflow-hidden rounded-xl border border-lll-border bg-lll-bg-softer">
            <div className="max-h-[62vh] overflow-y-auto scrollbar-thin">
              {loading ? (
                <ListSkeleton rows={7} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={<AppIcon name="search" className="h-5 w-5" />}
                  title="No encontramos colaboradores"
                  description="Probá buscando por otro nombre, email o equipo."
                />
              ) : (
                <ul className="lll-fade-in divide-y divide-lll-border">
                  {filtered.map((person) => (
                    <li key={person.id}>
                      <Link
                        href={`/owner/balances/employees/${person.id}`}
                        className="group flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-white/[0.035]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lll-border bg-lll-bg text-xs font-semibold text-sky-300">
                            {getInitials(person)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-lll-text">
                              {person.full_name ?? "Sin nombre"}
                            </p>
                            <p className="truncate text-[12px] text-lll-text-soft">
                              {person.email ?? "Sin email"}
                              {person.team ? ` · ${person.team}` : ""}
                            </p>
                          </div>
                        </div>

                        <span className="flex shrink-0 items-center gap-2 text-[12px] text-lll-text-soft transition group-hover:text-lll-text">
                          Ver balance
                          <AppIcon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </UserLayout>
  );
}
