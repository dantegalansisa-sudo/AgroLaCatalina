"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Boxes, ClipboardCheck, Download, PackagePlus, RotateCcw, ShoppingCart, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/app/providers";
import { ProductPicker } from "@/components/app/product-picker";
import { CategoryIcon } from "@/components/app/category";
import { Kpi } from "@/components/app/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, MoneyInput, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Chip, EmptyState, PageHeader, Skeleton, Table } from "@/components/ui/misc";
import { exportCSV } from "@/lib/csv";
import type { Movement, Product } from "@/lib/types";
import { cn, errorMessage, fmtDateTime, localISODate, num, qty, rd } from "@/lib/utils";

const TYPE_META: Record<Movement["type"], { label: string; icon: React.ElementType; variant: "success" | "danger" | "warning" | "primary" | "default" }> = {
  inicial: { label: "Inicial", icon: Sparkles, variant: "default" },
  entrada: { label: "Entrada", icon: ArrowDownLeft, variant: "success" },
  ajuste: { label: "Ajuste", icon: SlidersHorizontal, variant: "warning" },
  venta: { label: "Venta", icon: ShoppingCart, variant: "primary" },
  anulacion: { label: "Anulación", icon: RotateCcw, variant: "default" },
};

const REASONS = ["Conteo físico", "Producto dañado", "Producto vencido", "Pérdida o robo", "Uso interno", "Devolución a proveedor", "Corrección de error"];

type MovementRow = Movement & { product: Pick<Product, "id" | "name" | "presentation" | "category_id"> | null; user: { full_name: string } | null };

function InventoryView() {
  const { products, categories, reloadCatalog } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [rows, setRows] = React.useState<MovementRow[] | null>(null);
  const [type, setType] = React.useState<"all" | Movement["type"]>("all");
  const [product, setProduct] = React.useState<Product | null>(null);
  const [entryOpen, setEntryOpen] = React.useState(false);
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const catById = new Map(categories.map((c) => [c.id, c]));

  const productParam = params.get("producto");
  React.useEffect(() => {
    if (productParam && products.length) setProduct(products.find((p) => p.id === productParam) ?? null);
  }, [productParam, products]);

  const load = React.useCallback(async () => {
    setRows(null);
    let query = supabaseBrowser()
      .from("inventory_movements")
      .select("*, product:products(id,name,presentation,category_id), user:profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(product ? 500 : 200);
    if (product) query = query.eq("product_id", product.id);
    if (type !== "all") query = query.eq("type", type);
    const { data, error } = await query;
    if (error) toast.error(errorMessage(error));
    setRows((data ?? []) as MovementRow[]);
  }, [product, type]);

  React.useEffect(() => {
    load();
  }, [load]);

  const after = () => {
    reloadCatalog();
    load();
  };

  const current = product ? products.find((p) => p.id === product.id) ?? product : null;
  const totalUnits = products.filter((p) => p.active).reduce((a, p) => a + Math.max(p.stock, 0), 0);
  const costValue = products.filter((p) => p.active).reduce((a, p) => a + Math.max(p.stock, 0) * (p.cost ?? 0), 0);
  const priceValue = products.filter((p) => p.active).reduce((a, p) => a + Math.max(p.stock, 0) * p.price, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventario"
        description="Entradas de mercancía, ajustes y el historial de cada producto"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                exportCSV(
                  `inventario-${localISODate()}.csv`,
                  products.map((p) => ({
                    producto: p.name, presentacion: p.presentation ?? "", categoria: catById.get(p.category_id ?? "")?.name ?? "",
                    stock: p.stock, stock_minimo: p.min_stock, costo: p.cost ?? "", precio: p.price,
                    valor_costo: (p.cost ?? 0) * Math.max(p.stock, 0), valor_venta: p.price * Math.max(p.stock, 0),
                  })),
                )
              }
            >
              <Download /> Exportar inventario
            </Button>
            <Button variant="outline" onClick={() => setAdjustOpen(true)}><ClipboardCheck /> Ajuste</Button>
            <Button onClick={() => setEntryOpen(true)}><PackagePlus /> Entrada de mercancía</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Unidades en stock" value={qty(totalUnits)} icon={<Boxes />} />
        <Kpi label="Valor a costo" value={rd(costValue)} icon={<ArrowDownLeft />} tone="violet" hint="Solo productos con costo" />
        <Kpi label="Valor a precio de venta" value={rd(priceValue)} icon={<ArrowUpRight />} tone="accent" />
        <Kpi label="Bajo el mínimo" value={products.filter((p) => p.active && p.stock <= p.min_stock).length} icon={<SlidersHorizontal />} tone="warning" hint="productos" />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title={current ? "Historial del producto" : "Movimientos recientes"}
          description={current ? `${current.name} ${current.presentation ?? ""}` : "Últimos 200 movimientos"}
          className="pb-4"
        />
        <div className="flex flex-col gap-3 border-y border-border/70 px-4 py-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-2 lg:max-w-md">
            <ProductPicker value={product} onChange={(p) => { setProduct(p); if (!p) router.replace("/inventario"); }} placeholder="Filtrar por producto…" />
            {product && (
              <Button variant="ghost" size="icon" onClick={() => { setProduct(null); router.replace("/inventario"); }} aria-label="Quitar filtro"><X /></Button>
            )}
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <Chip active={type === "all"} onClick={() => setType("all")}>Todos</Chip>
            {(Object.keys(TYPE_META) as Movement["type"][]).map((t) => {
              const M = TYPE_META[t];
              return <Chip key={t} active={type === t} onClick={() => setType(t)}><M.icon /> {M.label}</Chip>;
            })}
          </div>
        </div>

        {current && (
          <div className="grid grid-cols-2 gap-3 border-b border-border/70 bg-muted/30 p-4 sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Stock actual</p><p className="num text-lg font-extrabold">{qty(current.stock)}</p></div>
            <div><p className="text-xs text-muted-foreground">Mínimo</p><p className="num text-lg font-bold">{qty(current.min_stock)}</p></div>
            <div><p className="text-xs text-muted-foreground">Costo</p><p className="num text-lg font-bold">{current.cost != null ? rd(current.cost) : "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Precio</p><p className="num text-lg font-bold">{current.price > 0 ? rd(current.price) : "Sin precio"}</p></div>
          </div>
        )}

        {!rows ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Boxes />} title="Sin movimientos" description="Registra una entrada de mercancía o un ajuste." />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Fecha</th>
                {!current && <th>Producto</th>}
                <th>Tipo</th>
                <th className="!text-right">Cantidad</th>
                <th className="!text-right">Stock después</th>
                <th>Detalle</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const M = TYPE_META[m.type];
                const q = Number(m.quantity);
                return (
                  <tr key={m.id} className="hover:bg-muted/40">
                    <td className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(m.created_at)}</td>
                    {!current && (
                      <td>
                        <button className="flex items-center gap-2.5 text-left hover:text-primary" onClick={() => setProduct(products.find((p) => p.id === m.product_id) ?? null)}>
                          <CategoryIcon category={catById.get(m.product?.category_id ?? "")} size="sm" />
                          <span className="max-w-[240px] truncate font-semibold">{m.product?.name} <span className="font-normal text-muted-foreground">{m.product?.presentation}</span></span>
                        </button>
                      </td>
                    )}
                    <td><Badge variant={M.variant}><M.icon /> {M.label}</Badge></td>
                    <td className={cn("num text-right font-bold", q > 0 ? "text-accent" : "text-danger")}>{q > 0 ? "+" : ""}{qty(q)}</td>
                    <td className="num text-right">{qty(m.stock_after)}</td>
                    <td className="max-w-[280px] text-xs text-muted-foreground">
                      <p className="truncate">{m.reason}</p>
                      {(m.supplier || m.unit_cost != null) && (
                        <p className="truncate">{m.supplier ? `Proveedor: ${m.supplier}` : ""}{m.unit_cost != null ? ` · Costo ${rd(m.unit_cost)}` : ""}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs">{m.user?.full_name ?? "Sistema"}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <EntryDialog open={entryOpen} onOpenChange={setEntryOpen} initial={current} onDone={after} />
      <AdjustDialog open={adjustOpen} onOpenChange={setAdjustOpen} initial={current} onDone={after} />
    </div>
  );
}

function EntryDialog({ open, onOpenChange, initial, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; initial: Product | null; onDone: () => void }) {
  const [product, setProduct] = React.useState<Product | null>(null);
  const [quantity, setQuantity] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [supplier, setSupplier] = React.useState("");
  const [note, setNote] = React.useState("");
  const [updateCost, setUpdateCost] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setProduct(initial);
      setQuantity("");
      setCost(initial?.cost != null ? String(initial.cost) : "");
      setNote("");
      setUpdateCost(true);
    }
  }, [open, initial]);

  async function save(keepOpen: boolean) {
    if (!product || num(quantity) <= 0) return toast.error("Selecciona el producto y la cantidad");
    setLoading(true);
    const { error } = await supabaseBrowser().rpc("inventory_entry", {
      p_product: product.id, p_quantity: num(quantity), p_unit_cost: cost === "" ? null : num(cost),
      p_supplier: supplier || null, p_note: note || null, p_update_cost: updateCost,
    });
    setLoading(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`+${qty(num(quantity))} ${product.name}`);
    onDone();
    if (keepOpen) {
      setProduct(null);
      setQuantity("");
      setCost("");
      setNote("");
    } else onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Entrada de mercancía" description="Registra lo que llegó del proveedor; el stock sube automáticamente" size="md">
        <DialogBody>
          <Field label="Producto *">
            <ProductPicker value={product} onChange={(p) => { setProduct(p); setCost(p?.cost != null ? String(p.cost) : ""); }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad recibida *">
              <Input type="number" inputMode="decimal" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="num" />
            </Field>
            <Field label="Costo unitario">
              <MoneyInput value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
          {product && num(quantity) > 0 && (
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs font-semibold text-accent">
              Stock: {qty(product.stock)} → {qty(product.stock + num(quantity))}
              {cost !== "" && ` · Total compra ${rd(num(cost) * num(quantity))}`}
            </p>
          )}
          <Field label="Proveedor">
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ej. Agroveterinaria Nagua" />
          </Field>
          <Field label="Nota">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Factura #, observaciones…" className="min-h-16" />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <span className="text-sm font-medium">Actualizar el costo del producto con este valor</span>
            <Switch checked={updateCost} onCheckedChange={setUpdateCost} />
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button variant="outline" onClick={() => save(true)} loading={loading}>Guardar y otra</Button>
          <Button onClick={() => save(false)} loading={loading}>Registrar entrada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ open, onOpenChange, initial, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; initial: Product | null; onDone: () => void }) {
  const [product, setProduct] = React.useState<Product | null>(null);
  const [newStock, setNewStock] = React.useState("");
  const [reason, setReason] = React.useState(REASONS[0]);
  const [detail, setDetail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setProduct(initial);
      setNewStock(initial ? String(initial.stock) : "");
      setReason(REASONS[0]);
      setDetail("");
    }
  }, [open, initial]);

  const diff = product && newStock !== "" ? num(newStock) - product.stock : 0;

  async function save() {
    if (!product || newStock === "") return toast.error("Selecciona el producto y el nuevo stock");
    setLoading(true);
    const { error } = await supabaseBrowser().rpc("inventory_adjust", {
      p_product: product.id, p_new_stock: num(newStock), p_reason: detail ? `${reason}: ${detail}` : reason,
    });
    setLoading(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Ajuste registrado");
    onDone();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Ajuste de inventario" description="Corrige el stock indicando el motivo; queda registrado en el historial" size="md">
        <DialogBody>
          <Field label="Producto *">
            <ProductPicker value={product} onChange={(p) => { setProduct(p); setNewStock(p ? String(p.stock) : ""); }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock actual">
              <Input value={product ? qty(product.stock) : ""} disabled className="num" />
            </Field>
            <Field label="Stock real (contado) *">
              <Input type="number" inputMode="decimal" step="0.01" min="0" value={newStock} onChange={(e) => setNewStock(e.target.value)} className="num" />
            </Field>
          </div>
          {product && diff !== 0 && (
            <p className={cn("rounded-xl px-3 py-2 text-xs font-semibold", diff > 0 ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger")}>
              Diferencia: {diff > 0 ? "+" : ""}{qty(diff)} unidades
            </p>
          )}
          <Field label="Motivo *">
            <NativeSelect value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Detalle (opcional)">
            <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Explica brevemente" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} loading={loading} disabled={!product || diff === 0}>Guardar ajuste</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InventarioPage() {
  return (
    <React.Suspense fallback={null}>
      <InventoryView />
    </React.Suspense>
  );
}
