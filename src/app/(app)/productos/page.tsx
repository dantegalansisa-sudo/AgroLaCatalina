"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileUp, MoreVertical, Pencil, Plus, Search, Tag, PackageX, Power, Boxes, CalendarClock, AlertTriangle, Layers } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/app/providers";
import { CategoryIcon, categoryStyle } from "@/components/app/category";
import { ProductFormDialog } from "@/components/app/product-form";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Chip, ChipRow, EmptyState, PageHeader, Skeleton, Table } from "@/components/ui/misc";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { exportCSV, parseCSV } from "@/lib/csv";
import type { Product } from "@/lib/types";
import { cn, daysUntil, errorMessage, fmtDate, localISODate, normalize, num, qty, rd } from "@/lib/utils";

type Filter = "todos" | "bajo" | "sinprecio" | "vence" | "inactivos";

function StockBadge({ p }: { p: Product }) {
  if (p.stock <= 0) return <Badge variant="danger">Agotado</Badge>;
  if (p.stock <= p.min_stock) return <Badge variant="warning">{qty(p.stock)} · bajo</Badge>;
  return <Badge variant="success">{qty(p.stock)}</Badge>;
}

function ExpiryBadge({ date, alertDays }: { date: string | null; alertDays: number }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const d = daysUntil(date);
  return (
    <span className={cn("text-xs", d < 0 ? "font-bold text-danger" : d <= alertDays ? "font-semibold text-warning" : "text-muted-foreground")}>
      {fmtDate(date)}
      {d < 0 ? " · vencido" : d <= alertDays ? ` · ${d} d` : ""}
    </span>
  );
}

function ProductsView() {
  const { products, categories, catalogLoading, isAdmin, settings, reloadCatalog } = useApp();
  const params = useSearchParams();
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [filter, setFilter] = React.useState<Filter>((params.get("filtro") as Filter) || "todos");
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const alertDays = settings?.expiry_alert_days ?? 30;
  const catById = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  React.useEffect(() => {
    const f = params.get("filtro") as Filter | null;
    if (f) setFilter(f);
  }, [params]);

  const list = React.useMemo(() => {
    const nq = normalize(q.trim());
    return products
      .filter((p) => (filter === "inactivos" ? !p.active : filter === "todos" ? true : p.active))
      .filter((p) => filter !== "bajo" || p.stock <= p.min_stock)
      .filter((p) => filter !== "sinprecio" || p.price <= 0)
      .filter((p) => filter !== "vence" || (p.expiry_date && daysUntil(p.expiry_date) <= alertDays))
      .filter((p) => cat === "all" || p.category_id === cat)
      .filter((p) => !nq || normalize(`${p.name} ${p.presentation ?? ""} ${p.barcode ?? ""}`).includes(nq));
  }, [products, q, cat, filter, alertDays]);

  const stats = {
    total: products.filter((p) => p.active).length,
    low: products.filter((p) => p.active && p.stock <= p.min_stock).length,
    noPrice: products.filter((p) => p.active && p.price <= 0).length,
    expiring: products.filter((p) => p.active && p.expiry_date && daysUntil(p.expiry_date) <= alertDays).length,
    value: products.reduce((a, p) => a + (p.active ? Math.max(p.stock, 0) * (isAdmin ? p.cost ?? 0 : p.price) : 0), 0),
  };

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setFormOpen(true);
  }

  async function toggleActive(p: Product) {
    const { error } = await supabaseBrowser().from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error(errorMessage(error));
    toast.success(p.active ? "Producto desactivado" : "Producto activado");
    reloadCatalog();
  }

  function doExport() {
    exportCSV(
      `productos-${localISODate()}.csv`,
      list.map((p) => ({
        nombre: p.name,
        presentacion: p.presentation ?? "",
        categoria: catById.get(p.category_id ?? "")?.name ?? "",
        codigo_barras: p.barcode ?? "",
        ...(isAdmin ? { costo: p.cost ?? "" } : {}),
        precio: p.price,
        stock: p.stock,
        stock_minimo: p.min_stock,
        vencimiento: p.expiry_date ?? "",
        activo: p.active ? "si" : "no",
      })),
    );
  }

  const filters: { v: Filter; l: string; icon: React.ElementType; n?: number }[] = [
    { v: "todos", l: "Todos", icon: Layers },
    { v: "bajo", l: "Stock bajo", icon: AlertTriangle, n: stats.low },
    { v: "sinprecio", l: "Sin precio", icon: Tag, n: stats.noPrice },
    { v: "vence", l: "Por vencer", icon: CalendarClock, n: stats.expiring },
    { v: "inactivos", l: "Inactivos", icon: Power },
  ];

  return (
    <div>
      <PageHeader
        title="Productos"
        description={`${stats.total} productos activos · ${isAdmin ? "Valor del inventario (costo)" : "Valor del inventario (precio)"}: ${rd(stats.value)}`}
        actions={
          <>
            <Button variant="outline" onClick={doExport}><Download /> Exportar</Button>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp /> Importar</Button>
                <Button onClick={openNew}><Plus /> Nuevo producto</Button>
              </>
            )}
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-border/70 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, presentación o código…" className="pl-10" />
            </div>
            <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-64">
              <option value="all">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelect>
          </div>
          <ChipRow className="-mx-4 px-4 md:mx-0 md:px-0">
            {filters.map((f) => (
              <Chip key={f.v} active={filter === f.v} onClick={() => setFilter(f.v)}>
                <f.icon /> {f.l} {f.n ? <span className="opacity-70">{f.n}</span> : null}
              </Chip>
            ))}
          </ChipRow>
        </div>

        {catalogLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : list.length === 0 ? (
          <EmptyState icon={<PackageX />} title="No hay productos que mostrar" description="Prueba con otro filtro o búsqueda." />
        ) : (
          <>
            {/* Tabla escritorio */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    {isAdmin && <th className="!text-right">Costo</th>}
                    <th className="!text-right">Precio</th>
                    <th className="!text-center">Stock</th>
                    <th>Vence</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const c = catById.get(p.category_id ?? "");
                    const margin = p.cost != null && p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : null;
                    return (
                      <tr key={p.id} className={cn("hover:bg-muted/40", !p.active && "opacity-55")}>
                        <td>
                          <div className="flex items-center gap-3">
                            <CategoryIcon category={c} size="sm" />
                            <div className="min-w-0">
                              <button onClick={() => isAdmin && openEdit(p)} className={cn("block max-w-[340px] truncate text-left font-semibold", isAdmin && "hover:text-primary")}>
                                {p.name}
                              </button>
                              <p className="text-xs text-muted-foreground">
                                {p.presentation ?? "—"}
                                {p.barcode && <span className="ml-2 font-mono text-[10.5px]">#{p.barcode}</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={cn("whitespace-nowrap text-xs font-semibold", categoryStyle(c).text)}>{c?.name ?? "—"}</span>
                        </td>
                        {isAdmin && (
                          <td className="num text-right">
                            {p.cost != null ? (
                              <div>
                                <p>{rd(p.cost)}</p>
                                {margin != null && <p className={cn("text-[11px]", margin < 0 ? "text-danger" : "text-accent")}>{margin.toFixed(0)}% margen</p>}
                              </div>
                            ) : (
                              <span className="whitespace-nowrap text-xs text-muted-foreground">Sin costo</span>
                            )}
                          </td>
                        )}
                        <td className="num text-right font-bold">
                          {p.price > 0 ? rd(p.price) : <Badge variant="warning"><Tag /> Sin precio</Badge>}
                        </td>
                        <td className="text-center"><StockBadge p={p} /></td>
                        <td><ExpiryBadge date={p.expiry_date} alertDays={alertDays} /></td>
                        <td>
                          {isAdmin && (
                            <Dropdown>
                              <DropdownTrigger asChild>
                                <button className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><MoreVertical className="size-4" /></button>
                              </DropdownTrigger>
                              <DropdownContent>
                                <DropdownItem onSelect={() => openEdit(p)}><Pencil /> Editar</DropdownItem>
                                <DropdownItem asChild><Link href={`/inventario?producto=${p.id}`}><Boxes /> Movimientos / entrada</Link></DropdownItem>
                                <DropdownItem onSelect={() => toggleActive(p)} danger={p.active}><Power /> {p.active ? "Desactivar" : "Activar"}</DropdownItem>
                              </DropdownContent>
                            </Dropdown>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {/* Lista móvil */}
            <ul className="divide-y divide-border/60 md:hidden">
              {list.map((p) => {
                const c = catById.get(p.category_id ?? "");
                return (
                  <li key={p.id}>
                    <button onClick={() => isAdmin && openEdit(p)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", !p.active && "opacity-55")}>
                      <CategoryIcon category={c} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.presentation ?? c?.name}</p>
                        {p.expiry_date && <ExpiryBadge date={p.expiry_date} alertDays={alertDays} />}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {p.price > 0 ? <span className="num text-sm font-bold">{rd(p.price)}</span> : <Badge variant="warning">Sin precio</Badge>}
                        <StockBadge p={p} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <div className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">Mostrando {list.length} de {products.length} productos</div>
      </Card>

      {isAdmin && <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />}
      {isAdmin && <ImportDialog open={importOpen} onOpenChange={setImportOpen} />}
    </div>
  );
}

/* ===================== Importar CSV ===================== */
function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { products, categories, reloadCatalog } = useApp();
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [fileName, setFileName] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setRows([]);
      setFileName("");
    }
  }, [open]);

  function template() {
    exportCSV("plantilla-productos.csv", [
      { nombre: "Ivermectina 1%", presentacion: "100 ml", categoria: "Medicamentos veterinarios", codigo_barras: "", costo: 250, precio: 350, stock: 10, stock_minimo: 3, vencimiento: "2027-06-30", activo: "si" },
    ]);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const data = await parseCSV(file);
      setRows(data.filter((r) => (r.nombre ?? "").trim()));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function run() {
    setLoading(true);
    const supabase = supabaseBrowser();
    const catByName = new Map(categories.map((c) => [normalize(c.name), c.id]));
    let created = 0, updated = 0, failed = 0;
    for (const r of rows) {
      const name = r.nombre.trim();
      const presentation = (r.presentacion ?? "").trim() || null;
      const barcode = (r.codigo_barras ?? r.codigo ?? "").trim() || null;
      const existing = products.find(
        (p) => (barcode && p.barcode === barcode) || (normalize(p.name) === normalize(name) && normalize(p.presentation ?? "") === normalize(presentation ?? "")),
      );
      const row: Record<string, unknown> = {
        name, presentation, barcode,
        category_id: catByName.get(normalize(r.categoria ?? "")) ?? existing?.category_id ?? null,
        price: num(r.precio),
        min_stock: r.stock_minimo ? num(r.stock_minimo) : existing?.min_stock ?? 3,
        expiry_date: /^\d{4}-\d{2}-\d{2}$/.test((r.vencimiento ?? "").trim()) ? r.vencimiento.trim() : null,
        active: !/^(no|0|false|inactivo)$/i.test((r.activo ?? "si").trim()),
      };
      if (r.stock !== undefined && r.stock !== "") row.stock = num(r.stock);
      const res = existing
        ? await supabase.from("products").update(row).eq("id", existing.id).select("id").single()
        : await supabase.from("products").insert(row).select("id").single();
      if (res.error) { failed++; continue; }
      if (r.costo !== undefined && r.costo !== "") {
        await supabase.from("product_costs").upsert({ product_id: res.data.id, cost: num(r.costo) });
      }
      if (existing) updated++; else created++;
    }
    setLoading(false);
    toast.success(`Importación lista: ${created} nuevos, ${updated} actualizados${failed ? `, ${failed} con error` : ""}`);
    reloadCatalog();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Importar productos" description="Desde un archivo CSV (Excel → Guardar como CSV UTF-8)" size="lg">
        <DialogBody>
          <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
            <p className="font-semibold">Columnas reconocidas</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">nombre, presentacion, categoria, codigo_barras, costo, precio, stock, stock_minimo, vencimiento (AAAA-MM-DD), activo</p>
            <p className="mt-2 text-xs text-muted-foreground">Si el producto ya existe (mismo código de barras, o mismo nombre y presentación) se actualiza; si no, se crea.</p>
            <Button variant="link" size="sm" className="mt-2" onClick={template}><Download /> Descargar plantilla</Button>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-8 text-center transition hover:border-primary/40 hover:bg-primary-soft/30">
            <FileUp className="size-7 text-muted-foreground" />
            <span className="text-sm font-semibold">{fileName || "Selecciona un archivo .csv"}</span>
            {rows.length > 0 && <span className="text-xs text-accent">{rows.length} productos listos para importar</span>}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          {rows.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-xl border border-border text-xs">
              <Table>
                <thead><tr><th>Nombre</th><th>Presentación</th><th>Categoría</th><th>Precio</th><th>Stock</th></tr></thead>
                <tbody>
                  {rows.slice(0, 30).map((r, i) => (
                    <tr key={i}><td>{r.nombre}</td><td>{r.presentacion}</td><td>{r.categoria}</td><td>{r.precio}</td><td>{r.stock}</td></tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={run} disabled={!rows.length} loading={loading}>Importar {rows.length || ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductosPage() {
  return (
    <React.Suspense fallback={null}>
      <ProductsView />
    </React.Suspense>
  );
}
