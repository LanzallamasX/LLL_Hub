import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-5 py-10 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lll-border bg-lll-bg-softer text-lll-accent-alt">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-lll-text">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[12px] leading-5 text-lll-text-soft">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
