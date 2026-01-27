"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

// Ojo: si no lo usás, podés borrar este import
// import { fetchMyProfile } from "@/lib/supabase/profile";

import {
  fetchMyProfileForAuth,
  ensureMyProfileForAuth,
} from "@/lib/supabase/profile";

type Role = "owner" | "user";

type AuthState = {
  isLoading: boolean;
  isAuthed: boolean;

  userId: string | null;
  email: string | null;

  role: Role;
  fullName: string | null;

  startDate: string | null;
  annualVacationDays: number | null;
};

type AuthContextValue = AuthState & {
  // (lo dejo por compatibilidad; podés sacarlo del login cuando migres 100%)
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

  resetPassword: (
    email: string
  ) => Promise<{ ok: boolean; error?: string }>;

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
    fullName: null,
    startDate: null,
    annualVacationDays: null,
  });

  async function setLoggedOutState() {
    setState({
      isLoading: false,
      isAuthed: false,
      userId: null,
      email: null,
      role: "user",
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
      await setLoggedOutState();
      return;
    }

    try {
      // Gate definitivo:
      // - valida allowlist (NOT_ALLOWED / NOT_ACTIVE)
      // - asegura/crea profile si corresponde
      const profile = await ensureMyProfileForAuth();

      setState({
        isLoading: false,
        isAuthed: true,
        userId: session.user.id,
        email: session.user.email ?? null,
        role: (profile?.role as Role) ?? "user",
        fullName: profile?.full_name ?? (session.user.email ?? null),
        startDate: profile?.start_date ?? null,
        annualVacationDays: profile?.annual_vacation_days ?? null,
      });
    } catch (e: any) {
      // Si no está allowlisted o está inactive => lo deslogueamos
      await supabase.auth.signOut();
      await setLoggedOutState();
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
  // MAGIC LINK (legacy / opcional)
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

      // 1) precheck allowlist (antes de crear auth user)
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
            full_name: fullName?.trim() || undefined,
          },
        },
      });

      if (error) return { ok: false, error: error.message };

      // OJO:
      // - Si tu proyecto requiere confirmación de email,
      //   acá no hay sesión todavía y el user debe confirmar.
      // - Si no requiere confirmación, onAuthStateChange hidrata y listo.

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
    await setLoggedOutState();
  }

  async function refreshProfile() {
    await hydrateFromProfile();
  }

  const value: AuthContextValue = {
    ...state,

    // auth methods
    signInWithMagicLink,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,

    // session helpers
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
