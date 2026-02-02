"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import UserLayout from "@/components/layout/UserLayout";
import { useAuth } from "@/contexts/AuthContext";

import { listProfiles, type ProfileRow } from "@/lib/supabase/profilesAdmin";

export default function OwnerBalancesEmployeesPage() {
  const router = useRouter();
  const { isLoading, isAuthed, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [q, setQ] = useState("");

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
        setLoading(true);
        const data = await listProfiles();
        setRows(data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoading, isAuthed, role, router]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((p) => {
      const name = (p.full_name ?? "").toLowerCase();
      const email = (p.email ?? "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [rows, q]);

  return (
    <UserLayout
      mode="owner"
      header={{
        title: "Balances por empleado",
        subtitle: "Elegí una persona para ver su balance y su historial.",
      }}
    >
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Empleados</p>
            <p className="text-[12px] text-lll-text-soft">
              {loading ? "Cargando…" : `${filtered.length} resultado(s)`}
            </p>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="w-full md:w-[420px] px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border text-sm placeholder:text-lll-text-soft outline-none"
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-lll-border bg-lll-bg-soft overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="p-4 text-[12px] text-lll-text-soft">Cargando empleados…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-[12px] text-lll-text-soft">
              No hay coincidencias con esa búsqueda.
            </div>
          ) : (
            <ul className="divide-y divide-lll-border">
              {filtered.map((p) => (
                <li key={p.id} className="p-4 hover:bg-lll-bg-softer transition">
                  <Link
                    href={`/owner/balances/employees/${p.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {p.full_name ?? "Sin nombre"}
                      </p>
                      <p className="text-[12px] text-lll-text-soft truncate">
                        {p.email ?? "sin email"}
                      </p>
                    </div>

                    <div className="text-[12px] text-lll-text-soft shrink-0">
                      Ver balance →
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </UserLayout>
  );
}
