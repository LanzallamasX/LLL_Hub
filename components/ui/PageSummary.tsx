import type { ReactNode } from "react";

export function PageSummary({
  leading,
  title,
  subtitle,
  meta,
  actions,
  className = "",
}: {
  leading: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-lll-border bg-lll-bg-soft p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight text-lll-text">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-1 text-sm text-lll-text-soft">{subtitle}</div>
            ) : null}
            {meta ? <div className="mt-2 flex flex-wrap gap-2">{meta}</div> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function SummaryIcon({
  children,
  tone = "text-lll-accent-alt",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-current/25 bg-white/[0.035] ${tone}`}
    >
      {children}
    </div>
  );
}

export function SummaryChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-lll-border bg-lll-bg-softer px-2.5 py-1 text-[11px] text-lll-text-soft">
      {children}
    </span>
  );
}
