import type { InputHTMLAttributes } from "react";
import { AppIcon } from "@/components/ui/AppIcon";

export function SearchField({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{props.placeholder ?? "Buscar"}</span>
      <AppIcon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lll-text-soft"
      />
      <input
        type="search"
        {...props}
        className="min-h-10 w-full rounded-lg border border-lll-border bg-lll-bg-softer py-2 pl-10 pr-3 text-sm text-lll-text outline-none transition-colors placeholder:text-lll-text-soft focus:border-lll-accent/60 focus:ring-2 focus:ring-lll-accent/10"
      />
    </label>
  );
}
