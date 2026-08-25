import { Skeleton } from "@/components/ui/Skeleton";

export default function BalancesSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start"
      role="status"
      aria-label="Cargando balances"
    >
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="mt-4 h-10 w-full" />
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="mt-3 rounded-2xl border border-lll-border bg-lll-bg-softer p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-7 w-12" />
            </div>
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
            <Skeleton className="mt-3 h-3 w-4/5" />
          </div>
        ))}
      </div>

      <div className="min-w-0 space-y-4">
        <div className="overflow-hidden rounded-2xl border border-lll-border bg-lll-bg-soft">
          <div className="border-b border-lll-border p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-16 w-16 sm:w-24" />
              ))}
            </div>
          </div>
          </div>
          <div className="grid items-center gap-4 p-4 sm:grid-cols-2">
            <Skeleton className="mx-auto h-52 w-52 rounded-full" />
            <div className="space-y-2">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-lll-border bg-lll-bg-soft">
          <div className="flex items-center justify-between border-b border-lll-border p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-1 p-3">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Cargando balances...</span>
    </div>
  );
}
