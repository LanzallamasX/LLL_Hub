"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

import { fetchMyProfile } from "@/lib/supabase/profile";

import { fetchMyProfileForAuth } from "@/lib/supabase/profile";


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
  signInWithMagicLink: (email: string) => Promise<{ ok: boolean; error?: string }>;
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


async function hydrateFromProfile() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
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
    return;
  }

  try {
    const profile = await fetchMyProfileForAuth();

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
  } catch {
    setState({
      isLoading: false,
      isAuthed: true,
      userId: session.user.id,
      email: session.user.email ?? null,
      role: "user",
      fullName: session.user.email ?? null,
      startDate: null,
      annualVacationDays: null,
    });
  }
}

  useEffect(() => {
    hydrateFromProfile();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      hydrateFromProfile();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInWithMagicLink(email: string) {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
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

async function signOut() {
  await supabase.auth.signOut();

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

async function refreshProfile() {
  await hydrateFromProfile();
}

const value: AuthContextValue = {
  ...state,
  signInWithMagicLink,
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
