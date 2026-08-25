"use client";

import UserLayout from "@/components/layout/UserLayout";
import { useNotifications } from "@/lib/notifications/useNotifications";
import { formatARDateTime } from "@/lib/date";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/LoadingSkeletons";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { SectionCard } from "@/components/ui/SectionCard";

export default function NotificationsPage() {
  const { items, loading, error } = useNotifications({ enabled: true, pollMs: 30000, limit: 50 });

  return (
    <UserLayout mode="user" header={{ title: "Notificaciones", subtitle: "Historial de avisos y eventos." }}>
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon>
              <AppIcon name="bell" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Centro de notificaciones"
          subtitle="Avisos, novedades y cambios en tus solicitudes."
          meta={<SummaryChip>{items.length} notificaciones</SummaryChip>}
        />

        <SectionCard
          title="Últimos eventos"
          description="Historial de actividad de tu cuenta."
          icon={<AppIcon name="clock" className="h-4 w-4" />}
        >
          <div className="overflow-hidden rounded-xl border border-lll-border bg-lll-bg-softer">

            {loading ? <ListSkeleton rows={5} /> : null}
            {error ? <div className="p-4 text-sm text-red-300">{error}</div> : null}

            {!loading && !error && items.length === 0 ? (
              <EmptyState
                icon={<AppIcon name="bell" className="h-5 w-5" />}
                title="No hay notificaciones"
                description="Cuando haya novedades importantes, van a aparecer acá."
              />
            ) : null}

            {!loading && !error ? (
              <div className="lll-fade-in divide-y divide-lll-border">
                {items.map((item) => (
                  <div key={item.notificationId} className="flex items-start gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-lll-border bg-lll-bg text-lll-accent-alt">
                      <AppIcon name="bell" className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold">{item.notification.title}</p>
                        <p className="whitespace-nowrap text-[11px] text-lll-text-soft">
                          {formatARDateTime(item.notification.created_at)}
                        </p>
                      </div>
                      {item.notification.body ? (
                        <p className="mt-1 text-[12px] text-lll-text-soft">{item.notification.body}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </UserLayout>
  );
}
