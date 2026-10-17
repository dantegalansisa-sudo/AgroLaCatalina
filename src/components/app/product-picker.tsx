"use client";
import * as React from "react";
import { Popover } from "radix-ui";
import { ChevronsUpDown, Search } from "lucide-react";
import { useApp } from "./providers";
import { CategoryIcon } from "./category";
import type { Product } from "@/lib/types";
import { cn, normalize, qty } from "@/lib/utils";

export function ProductPicker({ value, onChange, placeholder = "Seleccionar producto", className }: {
  value: Product | null; onChange: (p: Product | null) => void; placeholder?: string; className?: string;
}) {
  const { products, categories } = useApp();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const catById = new Map(categories.map((c) => [c.id, c]));
  const nq = normalize(q.trim());
  const list = products
    .filter((p) => !nq || normalize(`${p.name} ${p.presentation ?? ""} ${p.barcode ?? ""}`).includes(nq) || p.barcode === q.trim())
    .slice(0, 60);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={cn("flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-card px-3 text-left text-sm transition hover:border-primary/40", className)}>
          {value ? <CategoryIcon category={catById.get(value.category_id ?? "")} size="sm" className="size-6" /> : <Search className="size-4 text-muted-foreground" />}
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>
            {value ? `${value.name} ${value.presentation ?? ""}` : placeholder}
          </span>
          {value && <span className="num text-xs text-muted-foreground">Stock {qty(value.stock)}</span>}
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-72 rounded-xl border border-border bg-popover p-2 shadow-lift data-[state=open]:animate-in">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && list[0]) {
                e.preventDefault();
                onChange(list[0]);
                setOpen(false);
                setQ("");
              }
            }}
            placeholder="Buscar o escanear código…"
            className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary/50"
          />
          <div className="scrollbar-thin mt-2 max-h-72 overflow-y-auto">
            {list.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <CategoryIcon category={catById.get(p.category_id ?? "")} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.presentation ?? "—"}</span>
                </span>
                <span className="num text-xs text-muted-foreground">{qty(p.stock)}</span>
              </button>
            ))}
            {list.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Sin resultados</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
