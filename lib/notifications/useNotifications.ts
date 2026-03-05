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

function dedupeByNotificationId(list: NotificationInboxItem[]): NotificationInboxItem[] {
  const map = new Map<string, NotificationInboxItem>();
  for (const it of list) {
    // nos quedamos con el más nuevo si llega repetido
    const prev = map.get(it.notificationId);
    if (!prev || it.createdAt > prev.createdAt) map.set(it.notificationId, it);
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function toErrMsg(e: any): string {
  if (!e) return "Error cargando notificaciones.";
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  if (typeof e?.error_description === "string") return e.error_description;
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

  const [items, setItems] = useState<NotificationInboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  // ✅ evita overlaps de refresh (race conditions)
  const refreshInFlightRef = useRef<Promise<NotificationInboxItem[] | null> | null>(null);

  const refresh = useCallback(async (): Promise<NotificationInboxItem[] | null> => {
    if (!enabled) return null;

    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const p = (async () => {
      setLoading(true);
      setError(null);

      try {
        const [listRaw, cnt] = await Promise.all([
          listMyNotifications({ limit }),
          countMyUnreadNotifications(),
        ]);

        const list = dedupeByNotificationId(listRaw);

        setItems(list);
        setUnreadCount(cnt);

        return list;
      } catch (e: any) {
        setError(toErrMsg(e));
        return null;
      } finally {
        setLoading(false);
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = p;
    return p;
  }, [enabled, limit]);

  const markRead = useCallback(
    async (notificationIds: string[]) => {
      if (!notificationIds.length) return;

      const nowIso = new Date().toISOString();

      // optimistic UI
      setItems((prev) =>
        prev.map((it) =>
          notificationIds.includes(it.notificationId)
            ? { ...it, readAt: it.readAt ?? nowIso }
            : it
        )
      );

      setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));

      try {
        await markNotificationsRead(notificationIds);
      } catch (e) {
        await refresh();
        throw e;
      }

      await refresh();
    },
    [refresh]
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

    refresh();

    timerRef.current = window.setInterval(() => {
      refresh();
    }, pollMs);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, pollMs, refresh]);

  const unreadIds = useMemo(
    () => items.filter((i) => !i.readAt).map((i) => i.notificationId),
    [items]
  );

  return {
    items,
    unreadCount,
    unreadIds,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}