"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UserLayout from "@/components/layout/UserLayout";
import { useAuth } from "@/contexts/AuthContext";

import { supabase } from "@/lib/supabase/client";

import EditProfileModal, {
  type EditProfilePayload,
} from "@/components/modals/EditProfileModal";

// PRE-ALTA (allowlist)
import {
  AllowedUserRole,
  type AllowedUser,
  listAllowedUsers,
  createAllowedUser,
  deleteAllowedUser,
} from "@/lib/supabase/allowedUsers";

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

function getRowName(row: {
  email: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) {
  const fn = (row.first_name ?? "").trim();
  const ln = (row.last_name ?? "").trim();

  if (fn || ln) return `${fn} ${ln}`.trim();

  const legacy = (row.full_name ?? "").trim();
  return legacy || row.email || "—";
}

type PersonRow = {
  key: string;
  email: string;
  full_name: string | null;

  first_name: string | null;
  last_name: string | null;

  allow: AllowedUser | null;
  profile: ProfileRow | null;

  status: "pendiente" | "registrado" | "sin_allowlist";
};

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

  // ====== Allowlist list ======
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [allowedLoading, setAllowedLoading] = useState(true);

  // ====== Edit modal (PROFILES) ======
  const [editingProfile, setEditingProfile] = useState<ProfileRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // ====== UI ======
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
    setAllowedLoading(true);

    try {
      const [profilesData, allowedData] = await Promise.all([
        listProfiles(),
        listAllowedUsers(),
      ]);

      setProfiles(profilesData);
      setAllowedUsers(allowedData);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando usuarios.");
    } finally {
      setLoading(false);
      setAllowedLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoading && isAuthed && userId && role === "owner") {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthed, userId, role]);

  // ====== Unificar allowlist + profiles en una sola tabla “Personas” ======
  const people = useMemo<PersonRow[]>(() => {
    const byEmail = new Map<string, PersonRow>();

    // 1) base: allowlist
    for (const au of allowedUsers) {
      const keyEmail = (au.email ?? "").toLowerCase();
      byEmail.set(keyEmail, {
        key: `au:${au.id}`,
        email: au.email,
        full_name: au.full_name ?? null,

        // si todavía tu type AllowedUser no tiene first/last, lo leemos “soft”
        first_name: (au as any).first_name ?? null,
        last_name: (au as any).last_name ?? null,

        allow: au,
        profile: null,
        status: "pendiente",
      });
    }

    // 2) merge: profiles
    for (const p of profiles) {
      const keyEmail = (p.email ?? "").toLowerCase();
      const existing = byEmail.get(keyEmail);

      if (existing) {
        existing.profile = p;
        existing.status = "registrado";

        // prioridad: profile first/last si existen
        existing.first_name = p.first_name ?? existing.first_name;
        existing.last_name = p.last_name ?? existing.last_name;

        // fallback legacy
        existing.full_name = p.full_name ?? existing.full_name;
      } else {
        byEmail.set(keyEmail || `id:${p.id}`, {
          key: `p:${p.id}`,
          email: p.email ?? "—",
          full_name: p.full_name ?? null,
          first_name: p.first_name ?? null,
          last_name: p.last_name ?? null,
          allow: null,
          profile: p,
          status: "sin_allowlist",
        });
      }
    }

    // 3) filtro (🔧 ahora usa getRowName -> contempla first/last)
    const q = query.trim().toLowerCase();
    let list = Array.from(byEmail.values());

    if (q) {
      list = list.filter((row) => {
        const mail = (row.email ?? "").toLowerCase();
        const name = getRowName(row).toLowerCase();
        const team = (row.profile?.team ?? row.allow?.team ?? "").toLowerCase();
        return mail.includes(q) || name.includes(q) || team.includes(q);
      });
    }

    // 4) orden: Pendiente primero, luego Registrado, luego Sin allowlist
    const rank = (s: PersonRow["status"]) =>
      s === "pendiente" ? 0 : s === "registrado" ? 1 : 2;

    list.sort((a, b) => {
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return (a.email ?? "").localeCompare(b.email ?? "");
    });

    return list;
  }, [allowedUsers, profiles, query]);

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

      await refresh();

      setEmail("");
      setFullName("");
      setNewRole("user");
      setIsActive(true);

      alert(
        "Pre-alta creada en allowlist. Quedará como Pendiente hasta que la persona se registre."
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

  // ====== Eliminar definitivo ======
  async function handleDeletePerson(row: PersonRow) {
    setError(null);

    const ok = window.confirm(
      `⚠️ ELIMINAR DEFINITIVO: "${row.email}"\n\n` +
        `Esto borrará el usuario de Auth.\n` +
        `Por cascada se borrará su profile y sus ausencias/historial.\n\n` +
        `Si querés conservar historial, usá "Archivar".\n\n` +
        `¿Confirmás ELIMINAR?`
    );
    if (!ok) return;

    try {
      // Caso Pendiente: no existe profile/auth (todavía) => solo borrar allowlist
      if (!row.profile?.id) {
        if (row.allow?.id) {
          await deleteAllowedUser(row.allow.id);
        }
        await refresh();
        return;
      }

      // Caso Registrado: borrar de verdad via API (admin)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) throw new Error("No session token");

      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: row.profile.id,
          email: row.email, // para limpiar allowlist en el server si existe
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo eliminar el usuario.");
      }

      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando usuario.");
    }
  }

  // ====== Archivar y liberar email ======
  async function archiveAndFreeEmail(row: PersonRow) {
    setError(null);

    if (!row.profile?.id || !row.profile?.email) {
      setError(
        "Solo se puede archivar un usuario que ya esté registrado (profile)."
      );
      return;
    }

    const ok = window.confirm(
      `¿Archivar y liberar email "${row.email}"?\n\n` +
        `- Se desactivará el usuario\n` +
        `- Se cambiará su email a un alias archived\n` +
        `- Se eliminará su pre-alta (allowlist) si existiera\n\n` +
        `Esto es irreversible.`
    );
    if (!ok) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) throw new Error("No session token");

      const res = await fetch("/api/admin/archive-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: row.profile.id }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(json?.error ?? "No se pudo archivar el usuario.");

      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Error archivando usuario.");
    }
  }

  // ====== Enviar acceso (invite/recovery) ======
  async function sendAccess(email: string) {
    setError(null);

    try {
      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();

      if (sessErr) throw sessErr;

      const token = session?.access_token;
      if (!token) throw new Error("No session token");

      const res = await fetch("/api/admin/send-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo enviar el acceso.");

      alert("Acceso enviado. Revisar inbox/spam.");
    } catch (e: any) {
      setError(e?.message ?? "Error enviando acceso.");
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

  const busy = loading || allowedLoading;

  return (
    <UserLayout
      mode="owner"
      header={{
        title: "Usuarios",
        subtitle: "Gestioná personas y su estado (Pendiente / Registrado).",
      }}
    >
      {/* PRE-ALTA */}
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
        <p className="text-sm font-semibold">Pre-alta</p>
        <p className="mt-1 text-[12px] text-lll-text-soft">
          Crea la entrada en <code>allowed_users</code>. Quedará como{" "}
          <span className="text-lll-text">Pendiente</span> hasta que la persona
          se registre.
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
          {busy ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {/* TABLE: PERSONAS (unificada) */}
      <div className="mt-4 rounded-2xl border border-lll-border bg-lll-bg-soft overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[12px] text-lll-text-soft border-b border-lll-border">
          <div className="col-span-4">Email</div>
          <div className="col-span-3">Nombre</div>
          <div className="col-span-2">Rol</div>
          <div className="col-span-1">Activo</div>
          <div className="col-span-2 text-right">Estado / Acciones</div>
        </div>

        {busy ? (
          <div className="p-4 text-sm text-lll-text-soft">Cargando…</div>
        ) : people.length === 0 ? (
          <div className="p-4 text-sm text-lll-text-soft">No hay resultados.</div>
        ) : (
          people.map((row) => {
            const p = row.profile;

            const roleValue = (p?.role ?? row.allow?.role ?? "user") as ProfileRole;
            const isActiveValue = p?.active ?? row.allow?.is_active ?? true;
            const canEditProfile = Boolean(p);

            return (
              <div
                key={row.key}
                className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-lll-border/60 items-center"
              >
                <div className="col-span-4">{row.email}</div>

                <div className="col-span-3 text-lll-text-soft">
                  {getRowName(row)}
                </div>

                <div className="col-span-2">
                  {canEditProfile ? (
                    <select
                      value={roleValue}
                      onChange={(e) => changeRole(p!, e.target.value as ProfileRole)}
                      className="w-full px-2 py-1 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                    >
                      <option value="user">user</option>
                      <option value="owner">owner</option>
                    </select>
                  ) : (
                    <span className="px-2 py-1 rounded-lg border border-lll-border bg-lll-bg-softer text-[12px]">
                      {roleValue}
                    </span>
                  )}
                </div>

                <div className="col-span-1">
                  {canEditProfile ? (
                    <button
                      onClick={() => toggleActive(p!)}
                      type="button"
                      className={`px-2 py-1 rounded-lg border text-[12px] ${
                        isActiveValue
                          ? "border-lll-accent/50 bg-lll-accent-soft text-lll-text"
                          : "border-lll-border bg-lll-bg-softer text-lll-text-soft"
                      }`}
                    >
                      {isActiveValue ? "sí" : "no"}
                    </button>
                  ) : (
                    <span
                      className={`px-2 py-1 rounded-lg border text-[12px] ${
                        isActiveValue
                          ? "border-lll-accent/50 bg-lll-accent-soft text-lll-text"
                          : "border-lll-border bg-lll-bg-softer text-lll-text-soft"
                      }`}
                    >
                      {isActiveValue ? "sí" : "no"}
                    </span>
                  )}
                </div>

                <div className="col-span-2 flex justify-end gap-2">
                  <span
                    className={`px-2 py-1 rounded-lg border text-[12px] ${
                      row.status === "pendiente"
                        ? "border-lll-accent/50 bg-lll-accent-soft text-lll-text"
                        : "border-lll-border bg-lll-bg-softer text-lll-text-soft"
                    }`}
                  >
                    {row.status === "pendiente"
                      ? "Pendiente"
                      : row.status === "registrado"
                      ? "Registrado"
                      : "Sin allowlist"}
                  </span>

                  {canEditProfile && (
                    <button
                      onClick={() => openEdit(p!)}
                      type="button"
                      className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm text-lll-text-soft hover:text-lll-text"
                    >
                      Editar
                    </button>
                  )}

                  {/* ✅ NEW: Enviar acceso (pendiente o registrado) */}
                  <button
                    onClick={() => sendAccess(row.email)}
                    type="button"
                    className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm text-lll-text-soft hover:text-lll-text"
                    title="Envía invitación o recovery para que pueda acceder"
                  >
                    Enviar acceso
                  </button>

                  {row.profile && (
                    <button
                      onClick={() => archiveAndFreeEmail(row)}
                      type="button"
                      className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm text-lll-text-soft hover:text-lll-text"
                      title="Archiva el usuario y libera el email para reutilizar"
                    >
                      Archivar
                    </button>
                  )}

                  <button
                    onClick={() => handleDeletePerson(row)}
                    type="button"
                    className="px-3 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-sm text-lll-text-soft hover:text-lll-text"
                    title="Eliminar pre-alta y bloquear acceso"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })
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
