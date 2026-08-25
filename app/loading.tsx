import { Skeleton } from "@/components/ui/Skeleton";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-lll-bg px-6 text-lll-text">
      <div className="w-full max-w-sm rounded-2xl border border-lll-border bg-lll-bg-soft p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
