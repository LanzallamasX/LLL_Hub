// lib/notifications/useNotifications.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countMyUnreadNotifications,
  listMyNotifications,
  markNotificationsRead,
  markAllMyNotificationsRead,
  type NotificationInboxItem,
} from "@/lib/supabase/notifications";
import { useAuth } from "@/contexts/AuthContext";

type NotificationCacheEntry = {
  items: NotificationInboxItem[];
  unreadCount: number;
};

const notificationCache = new Map<string, NotificationCacheEntry>();

function dedupeByNotificationId(list: NotificationInboxItem[]): NotificationInboxItem[] {
  const map = new Map<string, NotificationInboxItem>();
  for (const it of list) {
    // nos quedamos con el más nuevo si llega repetido
    const prev = map.get(it.notificationId);
    if (!prev || it.createdAt > prev.createdAt) map.set(it.notificationId, it);
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function toErrMsg(e: unknown): string {
  if (!e) return "Error cargando notificaciones.";
  if (typeof e === "string") return e;
  if (typeof e === "object" && "message" in e && typeof e.message === "string") {
    return e.message;
  }
  if (
    typeof e === "object" &&
    "error_description" in e &&
    typeof e.error_description === "string"
  ) {
    return e.error_description;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return "Error cargando notificaciones.";
  }
}

export function useNotifications(opts?: { enabled?: boolean; pollMs?: number; limit?: number }) {
  const enabled = opts?.enabled ?? true;
  const pollMs = opts?.pollMs ?? 30000;
  const limit = opts?.limit ?? 8;
  const { userId } = useAuth();
  const cacheKey = `${userId ?? "anonymous"}:${limit}`;
  const initialCache = notificationCache.get(cacheKey);

  const [items, setItems] = useState<NotificationInboxItem[]>(
    () => initialCache?.items ?? []
  );
  const [unreadCount, setUnreadCount] = useState<number>(
    () => initialCache?.unreadCount ?? 0
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const activeKeyRef = useRef(cacheKey);
  activeKeyRef.current = cacheKey;
  const hasResolvedRef = useRef(Boolean(initialCache));

  // ✅ evita overlaps de refresh (race conditions)
  const refreshInFlightRef = useRef<Promise<NotificationInboxItem[] | null> | null>(null);

  const refresh = useCallback(async (): Promise<NotificationInboxItem[] | null> => {
    if (!enabled) return null;

    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const p = (async () => {
      const isInitialLoad = !hasResolvedRef.current;
      if (isInitialLoad) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const [listRaw, cnt] = await Promise.all([
          listMyNotifications({ limit }),
          countMyUnreadNotifications(),
        ]);

        const list = dedupeByNotificationId(listRaw);

        notificationCache.set(cacheKey, { items: list, unreadCount: cnt });
        hasResolvedRef.current = true;

        if (activeKeyRef.current === cacheKey) {
          setItems(list);
          setUnreadCount(cnt);
        }

        return list;
      } catch (e: unknown) {
        if (isInitialLoad) setError(toErrMsg(e));
        return null;
      } finally {
        if (activeKeyRef.current === cacheKey) {
          setLoading(false);
          setRefreshing(false);
        }
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = p;
    return p;
  }, [cacheKey, enabled, limit]);

  const markRead = useCallback(
    async (notificationIds: string[]) => {
      if (!notificationIds.length) return;

      const nowIso = new Date().toISOString();

      // optimistic UI
      setItems((prev) => {
        const next = prev.map((it) =>
          notificationIds.includes(it.notificationId)
            ? { ...it, readAt: it.readAt ?? nowIso }
            : it
        );
        notificationCache.set(cacheKey, {
          items: next,
          unreadCount: Math.max(0, unreadCount - notificationIds.length),
        });
        return next;
      });

      setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));

      try {
        await markNotificationsRead(notificationIds);
      } catch (e) {
        await refresh();
        throw e;
      }

      await refresh();
    },
    [cacheKey, refresh, unreadCount]
  );

  const markAllRead = useCallback(async () => {
    if (!enabled) return;
    try {
      await markAllMyNotificationsRead();
    } finally {
      await refresh();
    }
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;

    const cached = notificationCache.get(cacheKey);
    hasResolvedRef.current = Boolean(cached);
    setItems(cached?.items ?? []);
    setUnreadCount(cached?.unreadCount ?? 0);
    setLoading(false);
    setRefreshing(false);

    void refresh();

    timerRef.current = window.setInterval(() => {
      void refresh();
    }, pollMs);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [cacheKey, enabled, pollMs, refresh]);

  const unreadIds = useMemo(
    () => items.filter((i) => !i.readAt).map((i) => i.notificationId),
    [items]
  );

  return {
    items,
    unreadCount,
    unreadIds,
    loading,
    refreshing,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}
