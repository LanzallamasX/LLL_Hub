import * as React from "react";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "success" | "warning" | "danger" | "neutral";
};

export function Badge({
  variant = "neutral",
  className = "",
  ...props
}: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";

  const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    danger: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    neutral: "bg-slate-700/50 text-slate-200 border border-slate-600/60",
  };

  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
