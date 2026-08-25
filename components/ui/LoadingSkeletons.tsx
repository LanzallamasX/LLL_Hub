import { Skeleton } from "@/components/ui/Skeleton";

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando contenido">
      {Array.from({ length: rows }, (_, item) => (
        <div key={item} className="border-b border-lll-border p-4 last:border-b-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5 min-w-28" />
              <Skeleton className="h-3 w-3/5 min-w-40 max-w-full" />
            </div>
            <Skeleton className="h-6 w-20 shrink-0" />
          </div>
        </div>
      ))}
      <span className="sr-only">Cargando contenido...</span>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando tabla">
      {Array.from({ length: rows }, (_, item) => (
        <div
          key={item}
          className="grid grid-cols-1 gap-3 border-b border-lll-border/60 px-4 py-4 xl:grid-cols-12 xl:items-center xl:gap-2"
        >
          <div className="space-y-2 xl:col-span-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-2/3 xl:col-span-3" />
          <Skeleton className="h-7 w-20 xl:col-span-2" />
          <Skeleton className="h-6 w-12 xl:col-span-1" />
          <Skeleton className="h-8 w-full xl:col-span-2" />
        </div>
      ))}
      <span className="sr-only">Cargando tabla...</span>
    </div>
  );
}

export function FormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="mx-auto max-w-7xl space-y-4" role="status" aria-label="Cargando formulario">
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48 max-w-[55vw]" />
              <Skeleton className="h-3 w-72 max-w-[65vw]" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: sections }, (_, section) => (
          <div
            key={section}
            className={`rounded-2xl border border-lll-border bg-lll-bg-soft p-4 sm:p-5 ${
              sections > 2 && section === sections - 1 ? "xl:col-span-2" : ""
            }`}
          >
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-64 max-w-full" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((field) => (
                <div key={field} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando formulario...</span>
    </div>
  );
}
