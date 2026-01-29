"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ensureMyProfileForAuth } from "@/lib/supabase/profile";

type Role = "owner" | "user";

/**
 * Perfil "lite" (lo mínimo para hidratar UI).
 * Alineado con public.profiles.
 */
type ProfileLite = {
  id: string;
  email: string | null;

  role: Role;

  // legacy compat
  full_name: string | null;

  // normalizado
  first_name: string | null;
  last_name: string | null;

  // RRHH
  team: string | null;
  start_date: string | null; // YYYY-MM-DD

  // legacy compat
  annual_vacation_days: number; // ✅ siempre number (default 10)

  active: boolean; // ✅ siempre boolean (default true)
};

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normalizeRole(v: unknown): Role {
  return v === "owner" ? "owner" : "user";
}

function buildDisplayName(
  profile: Partial<ProfileLite> | null,
  email: string | null
): string {
  const fn = toStr(profile?.first_name).trim();
  const ln = toStr(profile?.last_name).trim();
  const full = `${fn} ${ln}`.trim();
  if (full) return full;

  const legacy = toStr(profile?.full_name).trim();
  if (legacy) return legacy;

  return email ?? "Usuario";
}

type AuthState = {
  isLoading: boolean;
  isAuthed: boolean;

  userId: string | null;
  email: string | null;

  role: Role;

  // ✅ source of truth para UI (lo que viene de DB)
  profile: ProfileLite | null;

  // ✅ derivado (usar en Header/Aside)
  displayName: string;

  // legacy / compat (para no romper pantallas existentes)
  fullName: string | null;
  startDate: string | null;
  annualVacationDays: number | null;
};

type AuthContextValue = AuthState & {
  signInWithMagicLink: (
    email: string
  ) => Promise<{ ok: boolean; error?: string }>;

  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;

  signUpWithPassword: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ ok: boolean; error?: string }>;

  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;

  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthed: false,
    userId: null,
    email: null,
    role: "user",

    profile: null,
    displayName: "Usuario",

    fullName: null,
    startDate: null,
    annualVacationDays: null,
  });

  function setLoggedOutState() {
    setState({
      isLoading: false,
      isAuthed: false,
      userId: null,
      email: null,
      role: "user",

      profile: null,
      displayName: "Usuario",

      fullName: null,
      startDate: null,
      annualVacationDays: null,
    });
  }

  async function hydrateFromProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setLoggedOutState();
      return;
    }

    const email = session.user.email ?? null;

    try {
      // Gate definitivo (allowlist + crea/asegura profile)
      const raw = (await ensureMyProfileForAuth()) as any;

      if (!raw) {
        // Si por alguna razón RPC devuelve null, tratamos como no permitido.
        await supabase.auth.signOut();
        setLoggedOutState();
        return;
      }

      // Normalizamos shape (por filas viejas / nulls)
      const normalized: ProfileLite = {
        id: raw.id ?? session.user.id,
        email: raw.email ?? email,

        role: normalizeRole(raw.role),

        full_name: raw.full_name ?? null,
        first_name: raw.first_name ?? null,
        last_name: raw.last_name ?? null,

        team: raw.team ?? null,
        start_date: raw.start_date ?? null,

        annual_vacation_days:
          typeof raw.annual_vacation_days === "number"
            ? raw.annual_vacation_days
            : 10,

        active: typeof raw.active === "boolean" ? raw.active : true,
      };

      // ✅ Si está desactivado => logout
      if (!normalized.active) {
        await supabase.auth.signOut();
        setLoggedOutState();
        return;
      }

      const displayName = buildDisplayName(normalized, email);

      setState({
        isLoading: false,
        isAuthed: true,
        userId: session.user.id,
        email,

        role: normalized.role,

        profile: normalized,
        displayName,

        // compat
        fullName: displayName,
        startDate: normalized.start_date ?? null,
        annualVacationDays: normalized.annual_vacation_days ?? null,
      });
    } catch {
      // NOT_ALLOWED / NOT_ACTIVE / errors => logout
      await supabase.auth.signOut();
      setLoggedOutState();
    }
  }

  useEffect(() => {
    hydrateFromProfile();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      hydrateFromProfile();
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // MAGIC LINK
  // =========================
  async function signInWithMagicLink(email: string) {
    try {
      const e = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo enviar el link. Probá de nuevo." };
    }
  }

  // =========================
  // PASSWORD AUTH
  // =========================
  async function signInWithPassword(email: string, password: string) {
    try {
      const e = email.trim().toLowerCase();

      const { error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      });
      if (error) return { ok: false, error: error.message };

      return { ok: true };
    } catch {
      return {
        ok: false,
        error: "No se pudo iniciar sesión. Probá de nuevo.",
      };
    }
  }

  async function signUpWithPassword(
    email: string,
    password: string,
    fullName?: string
  ) {
    try {
      const e = email.trim().toLowerCase();

      // 1) precheck allowlist
      const { data: allowed, error: allowedErr } = await supabase.rpc(
        "is_email_allowed",
        { p_email: e }
      );

      if (allowedErr) return { ok: false, error: allowedErr.message };
      if (!allowed)
        return {
          ok: false,
          error: "Este email no está habilitado para registrarse.",
        };

      // 2) signup
      const { error } = await supabase.auth.signUp({
        email: e,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            // legacy compat (si después querés, mandamos first/last desde el form)
            full_name: fullName?.trim() || undefined,
          },
        },
      });

      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo crear la cuenta. Probá de nuevo." };
    }
  }

  async function resetPassword(email: string) {
    try {
      const e = email.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo enviar el email. Probá de nuevo." };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setLoggedOutState();
  }

  async function refreshProfile() {
    await hydrateFromProfile();
  }

  const value: AuthContextValue = {
    ...state,

    signInWithMagicLink,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,

    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}
