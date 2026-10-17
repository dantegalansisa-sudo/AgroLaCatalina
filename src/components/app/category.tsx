import { Bug, Leaf, Package, PawPrint, Sprout, Syringe, Wrench, Droplets, Tractor, Pill, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  syringe: Syringe,
  paw: PawPrint,
  bug: Bug,
  leaf: Leaf,
  sprout: Sprout,
  wrench: Wrench,
  droplets: Droplets,
  tractor: Tractor,
  pill: Pill,
  package: Package,
};

export const CATEGORY_COLORS: Record<string, { soft: string; text: string; dot: string; bar: string }> = {
  rose: { soft: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500", bar: "#e11d48" },
  amber: { soft: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500", bar: "#d97706" },
  orange: { soft: "bg-orange-50 dark:bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500", bar: "#ea580c" },
  lime: { soft: "bg-lime-50 dark:bg-lime-500/10", text: "text-lime-700 dark:text-lime-400", dot: "bg-lime-600", bar: "#65a30d" },
  emerald: { soft: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-600", bar: "#059669" },
  sky: { soft: "bg-sky-50 dark:bg-sky-500/10", text: "text-sky-700 dark:text-sky-400", dot: "bg-sky-600", bar: "#0284c7" },
  violet: { soft: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-600", bar: "#7c3aed" },
  slate: { soft: "bg-slate-100 dark:bg-slate-500/10", text: "text-slate-600 dark:text-slate-300", dot: "bg-slate-500", bar: "#64748b" },
};

export function categoryStyle(cat?: Pick<Category, "color" | "icon"> | null) {
  const color = CATEGORY_COLORS[cat?.color ?? "slate"] ?? CATEGORY_COLORS.slate;
  const Icon = CATEGORY_ICONS[cat?.icon ?? "package"] ?? Package;
  return { ...color, Icon };
}

export function CategoryIcon({ category, className, size = "md" }: { category?: Pick<Category, "color" | "icon"> | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const { soft, text, Icon } = categoryStyle(category);
  const sizes = { sm: "size-7 rounded-lg [&_svg]:size-3.5", md: "size-9 rounded-xl [&_svg]:size-[18px]", lg: "size-11 rounded-2xl [&_svg]:size-5" };
  return (
    <span className={cn("grid shrink-0 place-items-center", soft, text, sizes[size], className)}>
      <Icon strokeWidth={2} />
    </span>
  );
}
