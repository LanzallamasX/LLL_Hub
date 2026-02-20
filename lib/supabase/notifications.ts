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
  .from("notification_recipients")
  .select(`
    notification_id,
    read_at,
    notification:notifications(
      id,type,title,body,actor_id,entity_type,entity_id,created_at
    )
  `)
  // 👇 ordena por la tabla joineada (alias "notification")
  .order("created_at", { foreignTable: "notification", ascending: false })
  .limit(limit);

  if (params?.onlyUnread) {
    q = q.is("read_at", null);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? [])
    .filter((r: any) => r.notification?.id)
    .map((r: any) => ({
      notificationId: r.notification_id,
      readAt: r.read_at,
      createdAt: r.notification.created_at,
      notification: r.notification,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // 👈 NEW → OLD

}

export async function countMyUnreadNotifications(): Promise<number> {
  const { count, error } = await supabase
    .from("notification_recipients")
    .select("notification_id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) return;

  const { error } = await supabase
    .from("notification_recipients")
    .update({ read_at: new Date().toISOString() })
    .in("notification_id", notificationIds)
    .is("read_at", null);

  if (error) throw error;
}

export async function markAllMyNotificationsRead() {
  const { error } = await supabase
    .from("notification_recipients")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) throw error;
}
