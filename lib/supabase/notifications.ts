// lib/supabase/notifications.ts
import { supabase } from "@/lib/supabase/client";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string; // timestamptz ISO
};

export type NotificationInboxItem = {
  notificationId: string;
  readAt: string | null;
  createdAt: string;
  notification: NotificationRow;
};

/**
 * Inbox del usuario actual:
 * Leemos desde notification_recipients y hacemos join a notifications.
 */
export async function listMyNotifications(params?: {
  limit?: number;
  onlyUnread?: boolean;
}): Promise<NotificationInboxItem[]> {
  const limit = params?.limit ?? 10;

  let q = supabase
    .from("my_inbox")
    .select(
      `
      user_id,
      notification_id,
      read_at,
      type,
      title,
      body,
      actor_id,
      entity_type,
      entity_id,
      created_at
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params?.onlyUnread) {
    q = q.is("read_at", null);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    notificationId: r.notification_id,
    readAt: r.read_at,
    createdAt: r.created_at,
    notification: {
      id: r.notification_id,
      type: r.type,
      title: r.title,
      body: r.body,
      actor_id: r.actor_id,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      created_at: r.created_at,
    },
  }));
}





export async function countMyUnreadNotifications(): Promise<number> {
  const { count, error } = await supabase
    .from("my_inbox")
    .select("notification_id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

/**
 * ✅ SINGLE (RPC): marca UNA notificación como leída para el usuario actual.
 * Requiere SQL:
 *   public.mark_notification_read(p_notification_id uuid)
 */
export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}

/**
 * ✅ BATCH (RPC): marca varias como leídas.
 * (lo hacemos uno por uno para mantenerlo simple y a prueba de RLS)
 */
export async function markNotificationsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  await Promise.all(notificationIds.map((id) => markNotificationRead(id)));
}

/**
 * ✅ ALL (RPC): marca TODAS como leídas.
 * Requiere SQL:
 *   public.mark_all_notifications_read()
 */
export async function markAllMyNotificationsRead() {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw error;
}
