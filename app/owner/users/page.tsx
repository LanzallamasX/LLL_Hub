"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UserLayout from "@/components/layout/UserLayout";
import { useAuth } from "@/contexts/AuthContext";

import EditProfileModal, {
  type EditProfilePayload,
} from "@/components/modals/EditProfileModal";

// PRE-ALTA (allowlist)
import { AllowedUserRole, createAllowedUser } from "@/lib/supabase/allowedUsers";

// SOURCE OF TRUTH (empleados reales)
import {
  type ProfileRow,
  type ProfileRole,
  listProfiles,
  updateProfile,
} from "@/lib/supabase/profilesAdmin";

function isValidEmail(email: string) {
  return email.trim().includes("@");
}

export default function OwnerUsersPage() {
  const router = useRouter();
  const { isLoading, isAuthed, userId, role } = useAuth();

  // ====== Profiles (empleados reales) ======
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ====== Pre-alta (allowlist) ======
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [newRole, setNewRole] = useState<AllowedUserRole>("user");
  const [isActive, setIsActive] = useState(true);

  // ====== Edit modal (PROFILES) ======
  const [editingProfile, setEditingProfile] = useState<ProfileRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [query, setQuery] = useState("");

  // Guards + redirects
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

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const data = await listProfiles();
      setProfiles(data);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoading && isAuthed && userId && role === "owner") {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthed, userId, role]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;

    return profiles.filter((p) => {
      const name = (p.full_name ?? "").toLowerCase();
      const mail = (p.email ?? "").toLowerCase();
      const team = (p.team ?? "").toLowerCase();
      return mail.includes(q) || name.includes(q) || team.includes(q);
    });
  }, [profiles, query]);

  // ====== Pre-alta: agrega a allowed_users ======
  async function handleAdd() {
    setError(null);

    const e = email.trim().toLowerCase();
    if (!isValidEmail(e)) {
      setError("Ingresá un email válido.");
      return;
    }

    try {
      await createAllowedUser({
        email: e,
        full_name: fullName.trim() || undefined,
        role: newRole,
        is_active: isActive,
      });

      setEmail("");
      setFullName("");
      setNewRole("user");
      setIsActive(true);

      alert(
        "Pre-alta creada en allowlist. Se reflejará en Usuarios cuando esa persona se registre."
      );
    } catch (err: any) {
      setError(err?.message ?? "Error agregando usuario.");
    }
  }

  // ====== Profiles: acciones reales ======
  async function toggleActive(p: ProfileRow) {
    setError(null);
    try {
      const updated = await updateProfile(p.id, { active: !p.active });
      setProfiles((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
    } catch (err: any) {
      setError(err?.message ?? "Error actualizando usuario.");
    }
  }

  async function changeRole(p: ProfileRow, nextRole: ProfileRole) {
    setError(null);
    try {
      const updated = await updateProfile(p.id, { role: nextRole });
      setProfiles((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
    } catch (err: any) {
      setError(err?.message ?? "Error actualizando rol.");
    }
  }

  function openEdit(p: ProfileRow) {
    setEditingProfile(p);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditingProfile(null);
  }

  async function saveEdit(id: string, payload: EditProfilePayload) {
    setError(null);
    try {
      const updated = await updateProfile(id, payload);
      setProfiles((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } catch (err: any) {
      setError(err?.message ?? "Error guardando cambios.");
      throw err;
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

  if (!isAuthed || !userId || role !== "owner") {
    return (
      <div className="min-h-screen bg-lll-bg text-lll-text flex items-center justify-center">
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
          Redirigiendo…
        </div>
      </div>
    );
  }

  return (
    <UserLayout
      mode="owner"
      header={{
        title: "Usuarios",
        subtitle: "Gestioná empleados (profiles) y pre-altas (allowlist).",
      }}
    >
      {/* PRE-ALTA */}
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
        <p className="text-sm font-semibold">Pre-alta (Allowlist)</p>
        <p className="mt-1 text-[12px] text-lll-text-soft">
          Esto crea la entrada en <code>allowed_users</code>. Se reflejará en
          Usuarios cuando la persona se registre.
        </p>

        <div className="mt-3 flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="text-[12px] text-lll-text-soft">Email</label>
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              placeholder="persona@lanzallamas.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </div>

          <div className="flex-1">
            <label className="text-[12px] text-lll-text-soft">
              Nombre (opcional)
            </label>
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              placeholder="Nombre Apellido"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              type="text"
            />
          </div>

          <div className="w-full md:w-[160px]">
            <label className="text-[12px] text-lll-text-soft">Rol</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AllowedUserRole)}
            >
              <option value="user">user</option>
              <option value="owner">owner</option>
            </select>
          </div>

          <div className="w-full md:w-[160px]">
            <label className="text-[12px] text-lll-text-soft">Estado</label>
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
              value={isActive ? "active" : "inactive"}
              onChange={(e) => setIsActive(e.target.value === "active")}
            >
              <option value="active">activo</option>
              <option value="inactive">inactivo</option>
            </select>
          </div>

          <button
            onClick={handleAdd}
            className="px-4 py-2 rounded-lg bg-lll-accent text-black font-semibold"
            type="button"
          >
            Agregar
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-lll-border bg-lll-bg-softer p-3 text-sm text-lll-text-soft">
            {error}
          </div>
        )}
      </div>

      {/* SEARCH + REFRESH */}
      <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="w-full md:w-[360px]">
          <input
            className="w-full px-3 py-2 rounded-lg bg-lll-bg-soft border border-lll-border outline-none text-sm"
            placeholder="Buscar por email, nombre o equipo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
          />
        </div>

        <button
          onClick={refresh}
          type="button"
          className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm text-lll-text-soft hover:text-lll-text"
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {/* TABLE: PROFILES */}
      <div className="mt-4 rounded-2xl border border-lll-border bg-lll-bg-soft overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[12px] text-lll-text-soft border-b border-lll-border">
          <div className="col-span-4">Email</div>
          <div className="col-span-3">Nombre</div>
          <div className="col-span-2">Rol</div>
          <div className="col-span-1">Activo</div>
          <div className="col-span-2 text-right">Acciones</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-lll-text-soft">Cargando…</div>
        ) : visibleItems.length === 0 ? (
          <div className="p-4 text-sm text-lll-text-soft">No hay usuarios.</div>
        ) : (
          visibleItems.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-lll-border/60 items-center"
            >
              <div className="col-span-4">{p.email ?? "—"}</div>
              <div className="col-span-3 text-lll-text-soft">
                {p.full_name ?? "—"}
              </div>

              <div className="col-span-2">
                <select
                  value={p.role}
                  onChange={(e) => changeRole(p, e.target.value as ProfileRole)}
                  className="w-full px-2 py-1 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                >
                  <option value="user">user</option>
                  <option value="owner">owner</option>
                </select>
              </div>

              <div className="col-span-1">
                <button
                  onClick={() => toggleActive(p)}
                  type="button"
                  className={`px-2 py-1 rounded-lg border text-[12px] ${
                    p.active
                      ? "border-lll-accent/50 bg-lll-accent-soft text-lll-text"
                      : "border-lll-border bg-lll-bg-softer text-lll-text-soft"
                  }`}
                >
                  {p.active ? "sí" : "no"}
                </button>
              </div>

              <div className="col-span-2 flex justify-end gap-2">
                <button
                  onClick={() => openEdit(p)}
                  type="button"
                  className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm text-lll-text-soft hover:text-lll-text"
                >
                  Editar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal real para PROFILES */}
      <EditProfileModal
        open={editOpen}
        user={editingProfile}
        onClose={closeEdit}
        onSave={saveEdit}
      />
    </UserLayout>
  );
}
