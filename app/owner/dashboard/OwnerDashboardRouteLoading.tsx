import UserLayout from "@/components/layout/UserLayout";
import { AppIcon } from "@/components/ui/AppIcon";
import { ListSkeleton } from "@/components/ui/LoadingSkeletons";
import {
  PageSummary,
  SummaryChip,
  SummaryIcon,
} from "@/components/ui/PageSummary";
import { SectionCard } from "@/components/ui/SectionCard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function OwnerDashboardRouteLoading() {
  return (
    <UserLayout
      mode="owner"
      header={{
        title: "Solicitudes",
        subtitle: "Revisión y gestión de ausencias del equipo.",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4" aria-busy="true">
        <PageSummary
          leading={
            <SummaryIcon tone="text-orange-300">
              <AppIcon name="absence" className="h-7 w-7" />
            </SummaryIcon>
          }
          title="Solicitudes del equipo"
          subtitle="Revisá, aprobá y acompañá cada solicitud desde una sola vista."
          meta={<SummaryChip>Cargando solicitudes…</SummaryChip>}
          actions={
            <div className="flex gap-2">
              <Skeleton className="h-10 w-28 rounded-lg" />
              <Skeleton className="h-10 w-20 rounded-lg" />
            </div>
          }
        />

        <SectionCard
          title="Buscar colaborador"
          description="Preparando solicitudes del equipo."
          icon={<AppIcon name="search" className="h-4 w-4" />}
          action={<Skeleton className="h-10 w-72 max-w-full rounded-full" />}
        >
          <span className="sr-only">Cargando filtros…</span>
        </SectionCard>

        <div className="overflow-hidden rounded-2xl border border-lll-border bg-lll-bg-soft">
          <ListSkeleton rows={6} />
        </div>
      </div>
    </UserLayout>
  );
}
