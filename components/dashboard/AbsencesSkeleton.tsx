import { Skeleton } from "@/components/ui/Skeleton";

export default function AbsencesSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando ausencias">
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[72, 92, 88, 96].map((width, item) => (
              <Skeleton key={item} className="h-10" style={{ width }} />
            ))}
          </div>
          <Skeleton className="h-10 w-full lg:w-[360px]" />
        </div>
      </div>

      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-7 w-20" />
        </div>
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="mt-3 rounded-xl border border-lll-border bg-lll-bg-softer p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="mt-3 h-3 w-56 max-w-full" />
            <Skeleton className="mt-2 h-3 w-36" />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando ausencias...</span>
    </div>
  );
}
