import { Skeleton } from "@/components/ui/Skeleton";

export default function CalendarSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      role="status"
      aria-label="Cargando calendario"
    >
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="mt-5 grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, item) => (
            <Skeleton key={item} className="h-20 w-full sm:h-24" />
          ))}
        </div>
      </div>

      <aside className="space-y-4 lg:col-span-1">
        {[0, 1, 2, 3].map((section) => (
          <div
            key={section}
            className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-10" />
            </div>
            <Skeleton className="mt-4 h-12 w-full" />
            <Skeleton className="mt-2 h-12 w-full" />
          </div>
        ))}
      </aside>
      <span className="sr-only">Cargando calendario...</span>
    </div>
  );
}
