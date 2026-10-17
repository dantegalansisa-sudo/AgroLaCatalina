"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Banknote, Camera, ChevronUp, CircleCheck, Landmark, Layers, Minus, NotebookPen, Percent, Plus, ScanBarcode, Search, ShoppingCart, Trash2, X, HandCoins, Tag, PackageX,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/app/providers";
import { CategoryIcon, categoryStyle } from "@/components/app/category";
import { CustomerPicker } from "@/components/app/customer-picker";
import { ScannerDialog } from "@/components/app/scanner-dialog";
import { OpenCashForm } from "@/components/app/open-cash";
import { Receipt } from "@/components/app/receipt";
import { ReceiptActions } from "@/components/app/receipt-actions";
import { Button } from "@/components/ui/button";
import { Input, MoneyInput, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Chip, ChipRow, EmptyState, Kbd, Segmented, Skeleton } from "@/components/ui/misc";
import { fetchSale } from "@/lib/receipt";
import type { Customer, PaymentMethod, Product, SaleFull } from "@/lib/types";
import { cn, errorMessage, normalize, num, qty, rd, round2 } from "@/lib/utils";

interface CartLine {
  productId: string;
  quantity: number;
  discount: number;
}

const CART_KEY = "lc-pos-cart-v1";

function useCart() {
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const loaded = React.useRef(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    loaded.current = true;
  }, []);
  React.useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines]);
  return [lines, setLines] as const;
}

type Method = PaymentMethod | "mixto";

/* ===================== Tarjeta de producto ===================== */
function ProductCard({ p, inCart, onAdd, disabledReason, category }: {
  p: Product; inCart: number; onAdd: () => void; disabledReason: string | null; category?: Parameters<typeof categoryStyle>[0];
}) {
  const { dot } = categoryStyle(category);
  const low = p.stock <= p.min_stock;
  return (
    <button
      onClick={onAdd}
      className={cn(
        "group relative flex min-h-[132px] flex-col rounded-2xl border bg-card p-3.5 text-left shadow-soft transition duration-150",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift active:translate-y-0 active:scale-[0.99]",
        inCart > 0 ? "border-primary/50 ring-2 ring-primary/15" : "border-border/70",
        disabledReason && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <CategoryIcon category={category} size="sm" />
        {inCart > 0 ? (
          <span className="num grid min-w-6 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-white">{qty(inCart)}</span>
        ) : (
          <span className={cn("mt-1 size-1.5 rounded-full", dot)} />
        )}
      </div>
      <p className="mt-2.5 line-clamp-2 text-[13.5px] font-bold leading-snug">{p.name}</p>
      {p.presentation && <p className="truncate text-xs text-muted-foreground">{p.presentation}</p>}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-0.5 pt-2.5">
        {p.price > 0 ? (
          <span className="num whitespace-nowrap text-[15px] font-extrabold tracking-tight">{rd(p.price)}</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-bold text-warning"><Tag className="size-3" />Sin precio</span>
        )}
        <span className={cn("num whitespace-nowrap text-[11px] font-semibold", p.stock <= 0 ? "text-danger" : low ? "text-warning" : "text-muted-foreground")}>
          {p.stock <= 0 ? "Agotado" : `${qty(p.stock)} disp.`}
        </span>
      </div>
      {inCart === 0 && (
        <span className="absolute right-3 top-3 hidden size-7 place-items-center rounded-lg bg-primary text-white opacity-0 shadow-md transition group-hover:opacity-100 lg:grid">
          <Plus className="size-4" />
        </span>
      )}
    </button>
  );
}

/* ===================== Página ===================== */
function POS() {
  const { products, categories, catalogLoading, cashSession, settings, isAdmin, reloadCatalog, reloadCash } = useApp();
  const router = useRouter();
  const search = useSearchParams();
  const [lines, setLines] = useCart();
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<string>("all");
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [note, setNote] = React.useState("");
  const [showNote, setShowNote] = React.useState(false);
  const [globalDisc, setGlobalDisc] = React.useState("");
  const [discMode, setDiscMode] = React.useState<"monto" | "pct">("monto");
  const [editDisc, setEditDisc] = React.useState<string | null>(null);
  const [checkout, setCheckout] = React.useState(false);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [scanOpen, setScanOpen] = React.useState(false);
  const [done, setDone] = React.useState<SaleFull | null>(null);
  const [priceFor, setPriceFor] = React.useState<Product | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const catById = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const allowNegative = !!settings?.allow_negative_stock;

  const visible = React.useMemo(() => {
    const nq = normalize(q.trim());
    return products
      .filter((p) => p.active)
      .filter((p) => cat === "all" || p.category_id === cat)
      .filter((p) => !nq || normalize(`${p.name} ${p.presentation ?? ""} ${p.barcode ?? ""}`).includes(nq))
      .sort((a, b) => Number(b.price > 0) - Number(a.price > 0) || a.name.localeCompare(b.name, "es"));
  }, [products, q, cat]);

  const counts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) if (p.active && p.category_id) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1);
    return m;
  }, [products]);

  // Totales
  const detailed = lines
    .map((l) => ({ ...l, product: byId.get(l.productId) }))
    .filter((l): l is CartLine & { product: Product } => !!l.product);
  const subtotal = round2(detailed.reduce((a, l) => a + l.product.price * l.quantity, 0));
  const lineDisc = round2(detailed.reduce((a, l) => a + Math.min(l.discount, l.product.price * l.quantity), 0));
  const afterLines = subtotal - lineDisc;
  const gd = num(globalDisc);
  const globalDiscount = round2(Math.min(discMode === "pct" ? (afterLines * Math.min(gd, 100)) / 100 : gd, afterLines));
  const total = round2(afterLines - globalDiscount);
  const itemsCount = detailed.reduce((a, l) => a + l.quantity, 0);

  function reasonFor(p: Product, extra = 1) {
    if (p.price <= 0) return "Este producto no tiene precio asignado";
    const inCart = lines.find((l) => l.productId === p.id)?.quantity ?? 0;
    if (!allowNegative && inCart + extra > p.stock) return p.stock <= 0 ? "Producto agotado" : `Solo hay ${qty(p.stock)} disponibles`;
    return null;
  }

  const add = React.useCallback(
    (p: Product, amount = 1) => {
      if (p.price <= 0) {
        if (isAdmin) setPriceFor(p);
        else toast.warning(`${p.name}: sin precio. Pide a la administradora que lo asigne.`);
        return;
      }
      const inCart = lines.find((l) => l.productId === p.id)?.quantity ?? 0;
      if (!allowNegative && inCart + amount > p.stock) {
        toast.error(p.stock <= 0 ? `${p.name} está agotado` : `Solo hay ${qty(p.stock)} de ${p.name}`);
        return;
      }
      setLines((ls) => {
        const ex = ls.find((l) => l.productId === p.id);
        if (ex) return ls.map((l) => (l.productId === p.id ? { ...l, quantity: round2(l.quantity + amount) } : l));
        return [...ls, { productId: p.id, quantity: amount, discount: 0 }];
      });
    },
    [lines, allowNegative, isAdmin, setLines],
  );

  function setQty(id: string, value: number) {
    const p = byId.get(id);
    if (!p) return;
    if (value <= 0) return setLines((ls) => ls.filter((l) => l.productId !== id));
    if (!allowNegative && value > p.stock) {
      toast.error(`Solo hay ${qty(p.stock)} de ${p.name}`);
      value = p.stock;
    }
    setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, quantity: round2(value) } : l)));
  }

  function clearSale() {
    setLines([]);
    setCustomer(null);
    setNote("");
    setShowNote(false);
    setGlobalDisc("");
  }

  const addByCode = React.useCallback(
    (code: string) => {
      const c = code.trim();
      if (!c) return false;
      const p = products.find((x) => x.active && x.barcode && x.barcode === c);
      if (p) {
        add(p);
        toast.success(`${p.name} agregado`, { duration: 1200 });
        return true;
      }
      return false;
    },
    [products, add],
  );

  // ?add=<id> desde el buscador global
  React.useEffect(() => {
    const id = search.get("add");
    if (!id || catalogLoading) return;
    const p = byId.get(id);
    if (p) add(p);
    router.replace("/vender");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, catalogLoading]);

  // Atajos y lector USB de códigos de barras (entra como teclado)
  React.useEffect(() => {
    let buffer = "";
    let lastTime = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (e.key === "F2" || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if ((e.key === "F9" || (e.ctrlKey && e.key === "Enter")) && lines.length && !checkout && !done) {
        e.preventDefault();
        setCheckout(true);
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      const now = Date.now();
      if (e.key === "Enter") {
        if (buffer.length >= 4 && addByCode(buffer)) e.preventDefault();
        buffer = "";
        return;
      }
      if (e.key.length === 1) {
        buffer = now - lastTime > 60 ? e.key : buffer + e.key;
        lastTime = now;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lines.length, checkout, done, addByCode]);

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (addByCode(q)) return setQ("");
      if (visible.length === 1) {
        add(visible[0]);
        setQ("");
      } else if (visible.length > 1 && q.trim()) {
        const exact = visible.find((p) => normalize(p.name) === normalize(q.trim()));
        if (exact) {
          add(exact);
          setQ("");
        }
      }
    }
    if (e.key === "Escape") setQ("");
  }

  async function onSold(saleId: string) {
    setCheckout(false);
    setCartOpen(false);
    clearSale();
    reloadCatalog();
    reloadCash();
    try {
      const s = await fetchSale(supabaseBrowser(), saleId);
      setDone(s);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (!cashSession && !catalogLoading) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <OpenCashForm />
      </div>
    );
  }

  /* ---------- Panel de carrito ---------- */
  const cartPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4 sm:px-5">
        <div>
          <h2 className="text-base font-extrabold tracking-tight">Venta actual</h2>
          <p className="text-xs text-muted-foreground">{itemsCount > 0 ? `${qty(itemsCount)} artículos · ${detailed.length} productos` : "Agrega productos para empezar"}</p>
        </div>
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSale} className="text-muted-foreground hover:text-danger">
            <Trash2 /> Vaciar
          </Button>
        )}
      </div>
      <div className="px-4 pb-3 sm:px-5">
        <CustomerPicker value={customer} onChange={setCustomer} />
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-y border-border/60 px-2 sm:px-3">
        {detailed.length === 0 ? (
          <EmptyState icon={<ShoppingCart />} title="Carrito vacío" description="Toca un producto, búscalo o escanea su código de barras." />
        ) : (
          <ul className="divide-y divide-border/60">
            {detailed.map((l) => {
              const gross = l.product.price * l.quantity;
              const dsc = Math.min(l.discount, gross);
              return (
                <li key={l.productId} className="px-2 py-3">
                  <div className="flex items-start gap-3">
                    <CategoryIcon category={catById.get(l.product.category_id ?? "")} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold">{l.product.name}</p>
                      <p className="num text-xs text-muted-foreground">
                        {l.product.presentation ? `${l.product.presentation} · ` : ""}{rd(l.product.price)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-sm font-extrabold">{rd(gross - dsc)}</p>
                      {dsc > 0 && <p className="num text-[11px] text-accent line-through decoration-accent/40">{rd(gross)}</p>}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 pl-10">
                    <div className="flex items-center rounded-xl border border-border bg-background">
                      <button className="grid size-8 place-items-center rounded-l-xl hover:bg-muted" onClick={() => setQty(l.productId, l.quantity - 1)} aria-label="Restar">
                        <Minus className="size-3.5" />
                      </button>
                      <input
                        className="num h-8 w-11 bg-transparent text-center text-sm font-bold outline-none"
                        inputMode="decimal"
                        value={l.quantity}
                        onChange={(e) => {
                          const v = num(e.target.value);
                          if (e.target.value === "") return;
                          setQty(l.productId, v);
                        }}
                      />
                      <button className="grid size-8 place-items-center rounded-r-xl hover:bg-muted" onClick={() => add(l.product)} aria-label="Sumar">
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    {editDisc === l.productId ? (
                      <div className="flex flex-1 items-center gap-1">
                        <MoneyInput
                          autoFocus
                          className="h-8 text-xs"
                          defaultValue={l.discount || ""}
                          placeholder="Desc."
                          onBlur={(e) => {
                            const v = Math.max(0, Math.min(num(e.target.value), gross));
                            setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, discount: round2(v) } : x)));
                            setEditDisc(null);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        />
                      </div>
                    ) : (
                      <button onClick={() => setEditDisc(l.productId)} className={cn("flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition", dsc > 0 ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted")}>
                        <Percent className="size-3.5" />
                        {dsc > 0 ? `-${rd(dsc)}` : "Desc."}
                      </button>
                    )}
                    <button onClick={() => setQty(l.productId, 0)} className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger" aria-label="Quitar">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="space-y-3 px-4 pb-4 pt-3 sm:px-5">
        {showNote ? (
          <Textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota de la venta (aparece en el recibo)" className="min-h-14 text-xs" />
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setShowNote(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <NotebookPen className="size-3.5" /> {note ? "Editar nota" : "Agregar nota"}
            </button>
          </div>
        )}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="num">{rd(subtotal)}</span></div>
          {lineDisc > 0 && <div className="flex justify-between text-accent"><span>Descuentos por línea</span><span className="num">-{rd(lineDisc)}</span></div>}
          <div className="flex items-center justify-between gap-2 text-muted-foreground">
            <span>Descuento total</span>
            <div className="flex items-center gap-1">
              <Segmented size="sm" value={discMode} onChange={setDiscMode} options={[{ value: "monto", label: "RD$" }, { value: "pct", label: "%" }]} className="p-0.5" />
              <Input value={globalDisc} onChange={(e) => setGlobalDisc(e.target.value)} inputMode="decimal" placeholder="0" className="num h-8 w-20 text-right text-xs" />
            </div>
          </div>
          {globalDiscount > 0 && <div className="flex justify-between text-accent"><span /><span className="num text-xs">-{rd(globalDiscount)}</span></div>}
          <div className="flex items-end justify-between border-t border-dashed border-border pt-2.5">
            <span className="font-bold">Total</span>
            <span className="num text-[26px] font-extrabold leading-none tracking-tight">{rd(total)}</span>
          </div>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" size="xl" onClick={clearSale} disabled={!lines.length} className="px-4" aria-label="Cancelar venta">
            <X />
          </Button>
          <Button size="xl" disabled={!lines.length || total <= 0} onClick={() => setCheckout(true)} className="text-[17px]">
            Cobrar {rd(total)}
            <Kbd className="ml-1 hidden border-white/30 bg-white/15 text-white lg:inline">F9</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="lg:-mb-2 lg:h-[calc(100dvh-6.5rem)]">
      <div className="grid h-full gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Carrito (escritorio) */}
        <aside className="hidden min-h-0 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft lg:block">{cartPanel}</aside>

        {/* Productos */}
        <section className="@container flex min-h-0 min-w-0 flex-col">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Buscar por nombre o escanear código…"
                className="h-12 rounded-2xl pl-11 pr-20 text-[15px] shadow-soft"
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                {q ? (
                  <button onClick={() => setQ("")} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
                ) : (
                  <span className="hidden items-center gap-1 text-[11px] text-muted-foreground lg:flex"><ScanBarcode className="size-4" /><Kbd>F2</Kbd></span>
                )}
              </div>
            </div>
            <Button variant="outline" size="icon" className="size-12 rounded-2xl" onClick={() => setScanOpen(true)} aria-label="Escanear con cámara">
              <Camera className="size-5" />
            </Button>
          </div>

          <ChipRow className="-mx-4 mt-3 px-4 pb-1 sm:mx-0 sm:px-0">
            <Chip active={cat === "all"} onClick={() => setCat("all")}>
              <Layers /> Todos <span className="opacity-60">{products.filter((p) => p.active).length}</span>
            </Chip>
            {categories.filter((c) => c.active).map((c) => {
              const { Icon } = categoryStyle(c);
              return (
                <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                  <Icon /> {c.name} <span className="opacity-60">{counts.get(c.id) ?? 0}</span>
                </Chip>
              );
            })}
          </ChipRow>

          <div className="scrollbar-thin -mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1 pb-28 lg:pb-2">
            {catalogLoading ? (
              <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5">
                {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState icon={<PackageX />} title="No se encontraron productos" description={q ? `Nada coincide con “${q}”.` : "No hay productos en esta categoría."} />
            ) : (
              <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5">
                {visible.map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    category={catById.get(p.category_id ?? "")}
                    inCart={lines.find((l) => l.productId === p.id)?.quantity ?? 0}
                    disabledReason={reasonFor(p, 0) ?? (!allowNegative && p.stock <= 0 ? "Agotado" : null)}
                    onAdd={() => add(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Barra inferior móvil con el carrito */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        <div className="flex gap-2">
          <button onClick={() => setCartOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-muted px-4 py-2.5 text-left">
            <span className="relative">
              <ShoppingCart className="size-5" />
              {itemsCount > 0 && <span className="num absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">{qty(itemsCount)}</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-muted-foreground">Ver carrito</span>
              <span className="num block truncate font-extrabold">{rd(total)}</span>
            </span>
            <ChevronUp className="size-4 text-muted-foreground" />
          </button>
          <Button size="xl" className="h-auto" disabled={!lines.length || total <= 0} onClick={() => setCheckout(true)}>
            Cobrar
          </Button>
        </div>
      </div>

      {/* Carrito móvil como panel inferior */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent title="Carrito" className="h-[88dvh] lg:hidden [&>div:first-child]:hidden">
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" />
          {cartPanel}
        </DialogContent>
      </Dialog>

      <CheckoutDialog
        open={checkout}
        onOpenChange={setCheckout}
        total={total}
        customer={customer}
        setCustomer={setCustomer}
        payload={{
          customer_id: customer?.id ?? null,
          note,
          global_discount: globalDiscount,
          items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, discount: l.discount })),
        }}
        onSold={onSold}
      />

      <ScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetected={(code) => {
          if (!addByCode(code)) toast.error(`Código ${code} no registrado`);
        }}
      />

      <SaleDoneDialog sale={done} onClose={() => { setDone(null); setTimeout(() => searchRef.current?.focus(), 50); }} />
      <QuickPriceDialog product={priceFor} onClose={() => setPriceFor(null)} onSaved={reloadCatalog} />
    </div>
  );
}

/* ===================== Cobro ===================== */
function CheckoutDialog({ open, onOpenChange, total, customer, setCustomer, payload, onSold }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  customer: Customer | null;
  setCustomer: (c: Customer | null) => void;
  payload: Record<string, unknown>;
  onSold: (saleId: string) => void;
}) {
  const [method, setMethod] = React.useState<Method>("efectivo");
  const [cash, setCash] = React.useState("");
  const [transfer, setTransfer] = React.useState("");
  const [credit, setCredit] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const cashRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setMethod("efectivo");
      setCash("");
      setTransfer("");
      setCredit("");
      setReference("");
      setTimeout(() => cashRef.current?.focus(), 80);
    }
  }, [open]);

  let payments: { method: PaymentMethod; amount: number; reference?: string }[] = [];
  let missing = 0;
  let change = 0;
  if (method === "efectivo") {
    const c = cash === "" ? total : num(cash);
    payments = [{ method: "efectivo", amount: c }];
    missing = Math.max(total - c, 0);
    change = Math.max(c - total, 0);
  } else if (method === "transferencia") {
    payments = [{ method: "transferencia", amount: total, reference }];
  } else if (method === "fiado") {
    payments = [{ method: "fiado", amount: total }];
  } else {
    const t = num(transfer), f = num(credit), c = num(cash);
    payments = [
      { method: "efectivo", amount: c },
      { method: "transferencia", amount: t, reference },
      { method: "fiado", amount: f },
    ].filter((p) => p.amount > 0) as typeof payments;
    const nonCash = t + f;
    missing = Math.max(total - nonCash - c, 0);
    change = nonCash <= total ? Math.max(c - (total - nonCash), 0) : 0;
  }
  const needsCustomer = payments.some((p) => p.method === "fiado" && p.amount > 0);
  const overNonCash = method === "mixto" && num(transfer) + num(credit) > total + 0.001;
  const canPay = !loading && missing < 0.01 && !(needsCustomer && !customer) && !overNonCash;

  async function pay() {
    if (!canPay) return;
    setLoading(true);
    const { data, error } = await supabaseBrowser().rpc("create_sale", { p: { ...payload, payments } });
    setLoading(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("¡Venta registrada!");
    onSold((data as { id: string }).id);
  }

  const quick = Array.from(new Set([total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000, 2000])).filter((v) => v >= total).slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Cobrar venta" description="Selecciona el método de pago" size="md">
        <DialogBody>
          <div className="rounded-2xl bg-muted/60 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total a cobrar</p>
            <p className="num mt-1 text-4xl font-extrabold tracking-tight">{rd(total)}</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([
              { v: "efectivo", l: "Efectivo", i: Banknote },
              { v: "transferencia", l: "Transfer.", i: Landmark },
              { v: "fiado", l: "Fiado", i: HandCoins },
              { v: "mixto", l: "Mixto", i: Layers },
            ] as const).map((m) => (
              <button
                key={m.v}
                onClick={() => setMethod(m.v)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1 py-3 text-xs font-bold transition",
                  method === m.v ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:border-input hover:text-foreground",
                )}
              >
                <m.i className="size-5" />
                {m.l}
              </button>
            ))}
          </div>

          {method === "efectivo" && (
            <div className="space-y-3">
              <div>
                <Label>Efectivo recibido</Label>
                <MoneyInput ref={cashRef} value={cash} onChange={(e) => setCash(e.target.value)} placeholder={total.toFixed(2)} className="h-14 text-2xl font-extrabold" onKeyDown={(e) => e.key === "Enter" && pay()} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {quick.map((v, i) => (
                  <button key={v} onClick={() => setCash(String(v))} className="num rounded-xl bg-muted py-2.5 text-sm font-bold hover:bg-muted/70">
                    {i === 0 ? "Exacto" : v.toLocaleString("es-DO")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {method === "transferencia" && (
            <div>
              <Label>Referencia / banco (opcional)</Label>
              <Input autoFocus value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej. BHD 123456" onKeyDown={(e) => e.key === "Enter" && pay()} />
            </div>
          )}

          {(method === "fiado" || method === "mixto") && (
            <div>
              <Label>Cliente {needsCustomer && <span className="text-primary">*</span>}</Label>
              <CustomerPicker value={customer} onChange={setCustomer} />
              {needsCustomer && !customer && <p className="mt-1.5 text-xs font-medium text-warning">Para vender fiado debes seleccionar o crear un cliente.</p>}
              {customer && Number(customer.balance) > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">Balance pendiente actual: <b className="text-warning">{rd(customer.balance)}</b></p>
              )}
            </div>
          )}

          {method === "mixto" && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Efectivo</Label>
                <MoneyInput ref={cashRef} value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Transferencia</Label>
                <MoneyInput value={transfer} onChange={(e) => setTransfer(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Fiado</Label>
                <MoneyInput value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="0" />
              </div>
              {num(transfer) > 0 && (
                <Input className="col-span-3" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referencia de la transferencia (opcional)" />
              )}
            </div>
          )}

          {(method === "efectivo" || method === "mixto") && (
            <div className={cn("flex items-center justify-between rounded-2xl px-4 py-3", missing > 0.009 ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent")}>
              <span className="text-sm font-bold">{missing > 0.009 ? "Falta por cobrar" : "Cambio a devolver"}</span>
              <span className="num text-2xl font-extrabold">{rd(missing > 0.009 ? missing : change)}</span>
            </div>
          )}
          {overNonCash && <p className="text-xs font-medium text-danger">Transferencia + fiado no pueden superar el total.</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Volver</Button>
          <Button size="lg" onClick={pay} disabled={!canPay} loading={loading} className="sm:min-w-48">
            {!loading && <CircleCheck />} Confirmar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== Venta completada ===================== */
function SaleDoneDialog({ sale, onClose }: { sale: SaleFull | null; onClose: () => void }) {
  const { settings } = useApp();
  return (
    <Dialog open={!!sale} onOpenChange={(v) => !v && onClose()}>
      {sale && (
        <DialogContent title="Venta completada" description={`Recibo #${String(sale.number).padStart(6, "0")}`} size="md">
          <DialogBody>
            <div className="flex items-center gap-4 rounded-2xl bg-accent-soft p-4 text-accent">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-white">
                <CircleCheck className="size-7" />
              </span>
              <div>
                <p className="num text-2xl font-extrabold">{rd(sale.total)}</p>
                {Number(sale.change_amount) > 0 ? (
                  <p className="text-sm font-semibold">Cambio: <span className="num">{rd(sale.change_amount)}</span></p>
                ) : (
                  <p className="text-sm font-semibold">Pago registrado</p>
                )}
              </div>
            </div>
            <ReceiptActions sale={sale} settings={settings} />
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-border bg-white p-2">
              <Receipt sale={sale} settings={settings} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button size="lg" className="w-full" onClick={onClose} autoFocus>
              <Plus /> Nueva venta
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

/* ===================== Asignar precio rápido (admin) ===================== */
function QuickPriceDialog({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [price, setPrice] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => setPrice(""), [product]);
  async function save() {
    if (!product || num(price) <= 0) return;
    setLoading(true);
    const { error } = await supabaseBrowser().from("products").update({ price: num(price) }).eq("id", product.id);
    setLoading(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Precio asignado");
    onSaved();
    onClose();
  }
  return (
    <Dialog open={!!product} onOpenChange={(v) => !v && onClose()}>
      {product && (
        <DialogContent title="Asignar precio" description={`${product.name} ${product.presentation ?? ""}`} size="sm">
          <DialogBody>
            <p className="text-sm text-muted-foreground">Este producto aún no tiene precio. Asígnalo para poder venderlo.</p>
            <MoneyInput autoFocus value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="h-12 text-lg font-bold" onKeyDown={(e) => e.key === "Enter" && save()} />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} loading={loading} disabled={num(price) <= 0}>Guardar precio</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

export default function VenderPage() {
  return (
    <React.Suspense fallback={null}>
      <POS />
    </React.Suspense>
  );
}
