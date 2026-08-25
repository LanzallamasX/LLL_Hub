import UserLayout from "@/components/layout/UserLayout";
import AbsencesSkeleton from "@/components/dashboard/AbsencesSkeleton";
import { AppIcon } from "@/components/ui/AppIcon";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { Skeleton } from "@/components/ui/Skeleton";

export default function AbsencesRouteLoading() {
  return (
    <UserLayout
      mode="user"
      header={{
        title: "Mis ausencias",
        subtitle: "Historial y gestión de tus solicitudes.",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4" aria-busy="true">
        <PageSummary
          leading={
            <SummaryIcon>
              <AppIcon name="absence" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Mis ausencias"
          subtitle="Creá solicitudes, revisá estados y editá mientras estén pendientes."
          meta={<SummaryChip>Cargando solicitudes…</SummaryChip>}
          actions={<Skeleton className="h-10 w-40 rounded-lg" />}
        />
        <AbsencesSkeleton />
      </div>
    </UserLayout>
  );
}
