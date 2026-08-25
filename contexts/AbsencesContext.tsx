"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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

import { buildDeductionFromAbsence } from "@/lib/absenceDeductions";
import { useAuth } from "@/contexts/AuthContext";

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}


type AbsencesContextValue = {
  absences: Absence[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  hasLoadedAllAbsences: boolean;
  hasLoadedMyAbsences: (userId: string) => boolean;

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
  const { userId: authUserId } = useAuth();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedAllAbsences, setHasLoadedAllAbsences] = useState(false);
  const [loadedUserIds, setLoadedUserIds] = useState<string[]>([]);

  const hasLoadedAllRef = React.useRef(false);
  const loadedUserIdsRef = React.useRef(new Set<string>());
  const requestsRef = React.useRef(new Map<string, Promise<void>>());

  const hasLoadedMyAbsences = useCallback(
    (userId: string) =>
      hasLoadedAllAbsences || loadedUserIds.includes(userId),
    [hasLoadedAllAbsences, loadedUserIds]
  );

  const pendingCount = useMemo(
    () => absences.filter((a) => a?.status === "pendiente").length,
    [absences]
  );

  const loadMyAbsences = useCallback(async (userId: string) => {
    const requestKey = `user:${userId}`;
    const pendingRequest = requestsRef.current.get(requestKey);
    if (pendingRequest) return pendingRequest;

    const hasCachedData =
      hasLoadedAllRef.current || loadedUserIdsRef.current.has(userId);

    const request = (async () => {
      if (hasCachedData) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const data = await listMyAbsences(userId);

        // Conserva los datos de otros usuarios que un owner ya haya cargado.
        // Así, navegar entre pantallas no vacía el contexto ni produce flashes.
        setAbsences((current) => [
          ...data,
          ...current.filter((absence) => absence.userId !== userId),
        ]);

        loadedUserIdsRef.current.add(userId);
        setLoadedUserIds(Array.from(loadedUserIdsRef.current));
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Error cargando ausencias."));
        loadedUserIdsRef.current.add(userId);
        setLoadedUserIds(Array.from(loadedUserIdsRef.current));
      } finally {
        if (hasCachedData) setIsRefreshing(false);
        else setIsLoading(false);
        requestsRef.current.delete(requestKey);
      }
    })();

    requestsRef.current.set(requestKey, request);
    return request;
  }, []);

  const loadAllAbsences = useCallback(async () => {
    const requestKey = "all";
    const pendingRequest = requestsRef.current.get(requestKey);
    if (pendingRequest) return pendingRequest;

    const hasCachedData = hasLoadedAllRef.current;

    const request = (async () => {
      if (hasCachedData) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const data = await listAllAbsencesForOwner();
        setAbsences(data);
        hasLoadedAllRef.current = true;
        setHasLoadedAllAbsences(true);
        for (const absence of data) {
          loadedUserIdsRef.current.add(absence.userId);
        }
        setLoadedUserIds(Array.from(loadedUserIdsRef.current));
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Error cargando ausencias del equipo."));
        hasLoadedAllRef.current = true;
        setHasLoadedAllAbsences(true);
      } finally {
        if (hasCachedData) setIsRefreshing(false);
        else setIsLoading(false);
        requestsRef.current.delete(requestKey);
      }
    })();

    requestsRef.current.set(requestKey, request);
    return request;
  }, []);

  const createAbsence = useCallback(async (input: CreateAbsenceInput) => {
    setError(null);
    try {
      const created = await dbCreateAbsence(input);
      setAbsences((prev) => [created, ...prev]);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Error creando solicitud."));
      throw e;
    }
  }, []);

  const updateAbsence = useCallback(async (id: string, input: UpdateAbsenceInput) => {
    setError(null);
    try {
      const updated = await dbUpdateAbsence(id, input);
      setAbsences((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Error actualizando solicitud."));
      throw e;
    }
  }, []);

  const setAbsenceStatus = useCallback(async (id: string, status: AbsenceStatus) => {
    setError(null);
    try {
      const updated = await updateAbsenceStatus(id, status);
      setAbsences((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Error actualizando estado."));
      throw e;
    }
  }, []);

  const approveAbsence = useCallback(async (id: string) => {
    setError(null);
    try {
      const absence = absences.find((a) => a.id === id);
      if (!absence) throw new Error("No se encontró la ausencia en el estado.");

      const deduction = buildDeductionFromAbsence(absence); // null si no descuenta
      const updated = await dbApproveAbsence(id, deduction ?? undefined);

      setAbsences((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Error aprobando solicitud."));
      throw e;
    }
  }, [absences]);

  const rejectAbsence = useCallback(async (id: string) => {
    setError(null);
    try {
      const updated = await dbRejectAbsence(id);
      setAbsences((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Error rechazando solicitud."));
      throw e;
    }
  }, []);

  // ✅ NUEVO
  const deleteAbsence = useCallback(async (id: string) => {
    setError(null);
    try {
      await dbDeleteAbsence(id);
      setAbsences((prev) => prev.filter((a) => a.id !== id));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Error eliminando solicitud."));
      throw e;
    }
  }, []);

  const reset = useCallback(() => {
    setAbsences([]);
    setIsLoading(false);
    setIsRefreshing(false);
    setError(null);
    setHasLoadedAllAbsences(false);
    setLoadedUserIds([]);
    hasLoadedAllRef.current = false;
    loadedUserIdsRef.current.clear();
    requestsRef.current.clear();
  }, []);

  const previousAuthUserRef = React.useRef<string | null>(authUserId);
  useEffect(() => {
    const previousUserId = previousAuthUserRef.current;
    if (previousUserId && previousUserId !== authUserId) reset();
    previousAuthUserRef.current = authUserId;
  }, [authUserId, reset]);

  const value: AbsencesContextValue = useMemo(
    () => ({
      absences,
      isLoading,
      isRefreshing,
      error,
      hasLoadedAllAbsences,
      hasLoadedMyAbsences,
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
      isRefreshing,
      error,
      hasLoadedAllAbsences,
      hasLoadedMyAbsences,
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
