"use client";

import { useEffect, useMemo, useState } from "react";
import type { AllowedUser, AllowedUserRole } from "@/lib/supabase/allowedUsers";

export type EditAllowedUserPayload = {
  full_name?: string | null;
  role?: AllowedUserRole;
  is_active?: boolean;
  team?: string | null;
  start_date?: string | null; // YYYY-MM-DD
  annual_vacation_days?: number;
};

export default function EditAllowedUserModal({
  open,
  user,
  onClose,
  onSave,
}: {
  open: boolean;
  user: AllowedUser | null;
  onClose: () => void;
  onSave: (id: number, payload: EditAllowedUserPayload) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AllowedUserRole>("user");
  const [isActive, setIsActive] = useState(true);
  const [team, setTeam] = useState("");
  const [startDate, setStartDate] = useState("");
  const [annualDays, setAnnualDays] = useState<number>(10);

  const canSave = useMemo(() => !!user, [user]);

  useEffect(() => {
    if (!open || !user) return;
    setFullName(user.full_name ?? "");
    setRole(user.role);
    setIsActive(user.is_active);
    setTeam(user.team ?? "");
    setStartDate(user.start_date ?? "");
    setAnnualDays(Number(user.annual_vacation_days ?? 10));
  }, [open, user]);

  if (!open) return null;

  async function handleSave() {
    if (!user) return;
    await onSave(user.id, {
      full_name: fullName.trim() ? fullName.trim() : null,
      role,
      is_active: isActive,
      team: team.trim() ? team.trim() : null,
      start_date: startDate || null,
      annual_vacation_days: Number.isFinite(annualDays) ? annualDays : 10,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-2xl border border-lll-border bg-lll-bg-soft overflow-hidden">
        <div className="p-4 border-b border-lll-border flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Editar usuario</p>
            <p className="text-[12px] text-lll-text-soft">{user?.email}</p>
          </div>

          <button
            className="w-9 h-9 rounded-full bg-lll-bg-softer border border-lll-border"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-lll-text-soft">Nombre</label>
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">Equipo</label>
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="Ej: Frontend, Diseño…"
              />
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">Fecha de ingreso</label>
              <input
                type="date"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">Días de vacaciones / año</label>
              <input
                type="number"
                min={0}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                value={annualDays}
                onChange={(e) => setAnnualDays(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">Rol</label>
              <select
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as AllowedUserRole)}
              >
                <option value="user">user</option>
                <option value="owner">owner</option>
              </select>
            </div>

            <div>
              <label className="text-[12px] text-lll-text-soft">Activo</label>
              <select
                className="mt-1 w-full px-3 py-2 rounded-lg bg-lll-bg-softer border border-lll-border outline-none text-sm"
                value={isActive ? "active" : "inactive"}
                onChange={(e) => setIsActive(e.target.value === "active")}
              >
                <option value="active">activo</option>
                <option value="inactive">inactivo</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-lll-text"
              type="button"
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 rounded-lg font-semibold bg-lll-accent text-black disabled:opacity-50"
              type="button"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
