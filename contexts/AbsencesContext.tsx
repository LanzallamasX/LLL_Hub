"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import type {
  Absence,
  AbsenceStatus,
  CreateAbsenceInput,
  UpdateAbsenceInput,
} from "@/lib/supabase/absences";

import {
  listMyAbsences,
  listAllAbsencesForOwner,
  createAbsence as dbCreateAbsence,
  approveAbsence as dbApproveAbsence,
  rejectAbsence as dbRejectAbsence,
  updateAbsenceStatus,
  updateAbsence as dbUpdateAbsence,
  deleteAbsence as dbDeleteAbsence, // ✅ NUEVO
} from "@/lib/supabase/absences";

type AbsencesContextValue = {
  absences: Absence[];
  isLoading: boolean;
  error: string | null;

  pendingCount: number;

  loadMyAbsences: (userId: string) => Promise<void>;
  loadAllAbsences: () => Promise<void>;

  createAbsence: (input: CreateAbsenceInput) => Promise<void>;
  updateAbsence: (id: string, input: UpdateAbsenceInput) => Promise<void>;

  deleteAbsence: (id: string) => Promise<void>; // ✅ NUEVO

  approveAbsence: (id: string) => Promise<void>;
  rejectAbsence: (id: string) => Promise<void>;
  setAbsenceStatus: (id: string, status: AbsenceStatus) => Promise<void>;

  reset: () => void;
};

const AbsencesContext = createContext<AbsencesContextValue | undefined>(undefined);

export function AbsencesProvider({ children }: { children: React.ReactNode }) {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => absences.filter((a) => a.status === "pendiente").length,
    [absences]
  );

  const loadMyAbsences = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listMyAbsences(userId);
      setAbsences(data);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando ausencias.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAllAbsences = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listAllAbsencesForOwner();
      setAbsences(data);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando ausencias del equipo.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createAbsence = useCallback(async (input: CreateAbsenceInput) => {
    setError(null);
    try {
      const created = await dbCreateAbsence(input);
      setAbsences((prev) => [created, ...prev]);
    } catch (e: any) {
      setError(e?.message ?? "Error creando solicitud.");
      throw e;
    }
  }, []);

  const updateAbsence = useCallback(async (id: string, input: UpdateAbsenceInput) => {
    setError(null);
    try {
      const updated = await dbUpdateAbsence(id, input);
      setAbsences((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando solicitud.");
      throw e;
    }
  }, []);

  const setAbsenceStatus = useCallback(async (id: string, status: AbsenceStatus) => {
    setError(null);
    try {
      const updated = await updateAbsenceStatus(id, status);
      setAbsences((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando estado.");
      throw e;
    }
  }, []);

  const approveAbsence = useCallback(async (id: string) => {
    setError(null);
    try {
      const updated = await dbApproveAbsence(id);
      setAbsences((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: any) {
      setError(e?.message ?? "Error aprobando solicitud.");
      throw e;
    }
  }, []);

  const rejectAbsence = useCallback(async (id: string) => {
    setError(null);
    try {
      const updated = await dbRejectAbsence(id);
      setAbsences((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: any) {
      setError(e?.message ?? "Error rechazando solicitud.");
      throw e;
    }
  }, []);

  // ✅ NUEVO
  const deleteAbsence = useCallback(async (id: string) => {
    setError(null);
    try {
      await dbDeleteAbsence(id);
      setAbsences((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando solicitud.");
      throw e;
    }
  }, []);

  const reset = useCallback(() => {
    setAbsences([]);
    setIsLoading(false);
    setError(null);
  }, []);

  const value: AbsencesContextValue = useMemo(
    () => ({
      absences,
      isLoading,
      error,
      pendingCount,

      loadMyAbsences,
      loadAllAbsences,

      createAbsence,
      updateAbsence,

      deleteAbsence, // ✅ NUEVO

      approveAbsence,
      rejectAbsence,
      setAbsenceStatus,

      reset,
    }),
    [
      absences,
      isLoading,
      error,
      pendingCount,
      loadMyAbsences,
      loadAllAbsences,
      createAbsence,
      updateAbsence,
      deleteAbsence,
      approveAbsence,
      rejectAbsence,
      setAbsenceStatus,
      reset,
    ]
  );

  return <AbsencesContext.Provider value={value}>{children}</AbsencesContext.Provider>;
}

export function useAbsences() {
  const ctx = useContext(AbsencesContext);
  if (!ctx) throw new Error("useAbsences must be used within <AbsencesProvider />");
  return ctx;
}
