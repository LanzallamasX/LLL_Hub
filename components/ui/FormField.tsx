import type { ReactNode } from "react";

export const formControlClassName =
  "mt-1.5 w-full rounded-lg border border-lll-border bg-lll-bg-softer px-3 py-2 text-sm text-lll-text outline-none transition-colors placeholder:text-lll-text-soft/70 focus:border-lll-accent/70 focus:ring-2 focus:ring-lll-accent/15 disabled:cursor-not-allowed disabled:opacity-55";

export function FormField({
  label,
  hint,
  className = "",
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="text-[12px] font-medium text-lll-text-soft">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[11px] leading-4 text-lll-text-soft">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
