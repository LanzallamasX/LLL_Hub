import type { ReactNode } from "react";

export function SectionCard({
  title,
  description,
  icon,
  action,
  children,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-lll-border bg-lll-bg-soft p-4 sm:p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-lll-border bg-lll-bg-softer text-lll-accent-alt">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-lll-text">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[12px] leading-5 text-lll-text-soft">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
