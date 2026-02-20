// lib/notifications/useNotifications.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countMyUnreadNotifications,
  listMyNotifications,
  markNotificationsRead,
  type NotificationInboxItem,
} from "@/lib/supabase/notifications";

export function useNotifications(opts?: { enabled?: boolean; pollMs?: number; limit?: number }) {
  const enabled = opts?.enabled ?? true;
  const pollMs = opts?.pollMs ?? 30000;
  const limit = opts?.limit ?? 8;

  const [items, setItems] = useState<NotificationInboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async (): Promise<NotificationInboxItem[] | null> => {
    if (!enabled) return null;

    setLoading(true);
    setError(null);

    try {
      const [list, cnt] = await Promise.all([
        listMyNotifications({ limit }),
        countMyUnreadNotifications(),
      ]);

      setItems(list);
      setUnreadCount(cnt);

      return list; // 👈 clave
    } catch (e: any) {
      setError(e?.message ?? "Error cargando notificaciones.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, limit]);

  const markRead = useCallback(
    async (notificationIds: string[]) => {
      await markNotificationsRead(notificationIds);
      await refresh();
    },
    [refresh]
  );

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
  };
}