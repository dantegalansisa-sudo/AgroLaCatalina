import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  icon,
  hint,
  delta,
  tone = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  hint?: React.ReactNode;
  delta?: number | null;
  tone?: "primary" | "accent" | "warning" | "sky" | "violet";
  className?: string;
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent-soft text-accent",
    warning: "bg-warning-soft text-warning",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  };
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card p-4 shadow-soft sm:p-5", className)}>
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5", tones[tone])}>{icon}</span>
        <p className="truncate text-[13px] font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="num mt-3 truncate text-xl font-extrabold tracking-tight sm:text-2xl">{value}</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {delta != null && Number.isFinite(delta) && (
          <span className={cn("inline-flex items-center font-semibold", delta >= 0 ? "text-accent" : "text-danger")}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className="truncate">{hint}</span>}
      </div>
    </div>
  );
}
