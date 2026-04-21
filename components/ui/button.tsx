import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60 disabled:cursor-not-allowed";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
primary:
  "bg-[#ff6b3d] text-black hover:bg-[#e65a2f] border border-[#ff6b3d] shadow-[0_4px_14px_rgba(255,107,61,0.35)] active:scale-[0.98]",

  secondary:
    "bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-700",

  ghost:
    "bg-transparent text-slate-200 hover:bg-slate-900 border border-transparent",
};

  const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
