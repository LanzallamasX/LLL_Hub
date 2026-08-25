import { Skeleton } from "@/components/ui/Skeleton";

export default function BalancesSkeleton() {
  return (
    <div
      className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3"
      role="status"
      aria-label="Cargando balances"
    >
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4 lg:col-span-1">
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

      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
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
          <Skeleton className="mx-auto mt-6 h-52 w-52 rounded-full" />
        </div>

        <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-5 h-44 w-full" />
        </div>
      </div>
      <span className="sr-only">Cargando balances...</span>
    </div>
  );
}
