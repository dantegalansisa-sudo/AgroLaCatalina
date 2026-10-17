"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { CornerDownLeft, Search } from "lucide-react";
import { useApp } from "./providers";
import { NAV } from "./nav";
import { CategoryIcon } from "./category";
import { Kbd } from "@/components/ui/misc";
import { cn, normalize, qty, rd } from "@/lib/utils";

type Result =
  | { kind: "page"; id: string; label: string; href: string; icon: React.ElementType }
  | { kind: "product"; id: string; label: string; sub: string; price: number; stock: number; categoryId: string | null };

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { products, categories, isAdmin } = useApp();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const results = React.useMemo<Result[]>(() => {
    const nq = normalize(q.trim());
    const pages: Result[] = NAV.filter((n) => (!n.adminOnly || isAdmin) && (!nq || normalize(n.label).includes(nq))).map((n) => ({
      kind: "page", id: n.href, label: n.label, href: n.href, icon: n.icon,
    }));
    const prods: Result[] = !nq
      ? []
      : products
          .filter((p) => p.active && (normalize(`${p.name} ${p.presentation ?? ""}`).includes(nq) || p.barcode === q.trim()))
          .slice(0, 12)
          .map((p) => ({ kind: "product", id: p.id, label: p.name, sub: p.presentation ?? "", price: p.price, stock: p.stock, categoryId: p.category_id }));
    return nq ? [...prods, ...pages] : pages;
  }, [q, products, isAdmin]);

  React.useEffect(() => setIdx(0), [q]);
  React.useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  function choose(r: Result) {
    onOpenChange(false);
    if (r.kind === "page") router.push(r.href);
    else router.push(`/vender?add=${r.id}`);
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <D.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lift outline-none data-[state=open]:animate-in">
          <D.Title className="sr-only">Buscar</D.Title>
          <D.Description className="sr-only">Busca productos o páginas</D.Description>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-5 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
                if (e.key === "Enter" && results[idx]) { e.preventDefault(); choose(results[idx]); }
              }}
              placeholder="Buscar producto, código o página…"
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div ref={listRef} className="scrollbar-thin max-h-[55vh] overflow-y-auto p-2">
            {results.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted-foreground">Sin resultados para “{q}”</p>}
            {results.map((r, i) => (
              <button
                key={r.kind + r.id}
                data-idx={i}
                onMouseEnter={() => setIdx(i)}
                onClick={() => choose(r)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition", i === idx && "bg-muted")}
              >
                {r.kind === "page" ? (
                  <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground"><r.icon className="size-[18px]" /></span>
                ) : (
                  <CategoryIcon category={categories.find((c) => c.id === r.categoryId)} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.kind === "page" ? "Ir a la página" : `${r.sub ? r.sub + " · " : ""}Stock ${qty(r.stock)}`}
                  </span>
                </span>
                {r.kind === "product" && (
                  <span className={cn("num text-sm font-bold", r.price <= 0 && "text-warning")}>{r.price > 0 ? rd(r.price) : "Sin precio"}</span>
                )}
                {i === idx && <CornerDownLeft className="size-4 text-muted-foreground" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navegar</span>
            <span><Kbd>Enter</Kbd> abrir / agregar a la venta</span>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
