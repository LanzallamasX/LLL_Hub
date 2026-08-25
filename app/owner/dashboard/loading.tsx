import UserLayout from "@/components/layout/UserLayout";
import CalendarSkeleton from "@/components/dashboard/CalendarSkeleton";
import { AppIcon } from "@/components/ui/AppIcon";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";

export default function OwnerDashboardLoading() {
  return (
    <UserLayout
      mode="owner"
      header={{ title: "Dashboard", subtitle: "Resumen operativo del equipo." }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <PageSummary
          leading={
            <SummaryIcon tone="text-cyan-300">
              <AppIcon name="users" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Panel del equipo"
          subtitle="Revisá pendientes, disponibilidad y próximos movimientos desde una sola vista."
          meta={<SummaryChip>Cargando equipo…</SummaryChip>}
        />
        <CalendarSkeleton calendarRight />
      </div>
    </UserLayout>
  );
}
