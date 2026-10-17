"use client";
import * as React from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "./providers";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Product } from "@/lib/types";
import { errorMessage, num, rd } from "@/lib/utils";

export function ProductFormDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (v: boolean) => void; product: Product | null }) {
  const { categories, reloadCatalog } = useApp();
  const isNew = !product;
  const [f, setF] = React.useState({
    name: "", presentation: "", category_id: "", barcode: "", cost: "", price: "", stock: "", min_stock: "3", expiry_date: "", active: true,
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setF({
      name: product?.name ?? "",
      presentation: product?.presentation ?? "",
      category_id: product?.category_id ?? categories[0]?.id ?? "",
      barcode: product?.barcode ?? "",
      cost: product?.cost != null ? String(product.cost) : "",
      price: product && product.price > 0 ? String(product.price) : "",
      stock: product ? String(product.stock) : "",
      min_stock: product ? String(product.min_stock) : "3",
      expiry_date: product?.expiry_date ?? "",
      active: product?.active ?? true,
    });
  }, [open, product, categories]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const price = num(f.price);
  const cost = f.cost === "" ? null : num(f.cost);
  const margin = cost != null && price > 0 ? ((price - cost) / price) * 100 : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("El nombre es obligatorio");
    setLoading(true);
    const supabase = supabaseBrowser();
    const row = {
      name: f.name.trim(),
      presentation: f.presentation.trim() || null,
      category_id: f.category_id || null,
      barcode: f.barcode.trim() || null,
      price,
      min_stock: num(f.min_stock),
      expiry_date: f.expiry_date || null,
      active: f.active,
      ...(isNew ? { stock: num(f.stock) } : {}),
    };
    const res = isNew
      ? await supabase.from("products").insert(row).select("id").single()
      : await supabase.from("products").update(row).eq("id", product!.id).select("id").single();
    if (res.error) {
      setLoading(false);
      return toast.error(errorMessage(res.error));
    }
    const id = res.data.id as string;
    const costRes = await supabase.from("product_costs").upsert({ product_id: id, cost, updated_at: new Date().toISOString() });
    setLoading(false);
    if (costRes.error) toast.error(errorMessage(costRes.error));
    toast.success(isNew ? "Producto creado" : "Producto actualizado");
    await reloadCatalog();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={isNew ? "Nuevo producto" : "Editar producto"} description={isNew ? "Agrega un producto al catálogo" : product?.name} size="lg">
        <form onSubmit={save}>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre *" className="sm:col-span-2">
              <Input autoFocus value={f.name} onChange={set("name")} placeholder="Ej. Ivermectina 1%" />
            </Field>
            <Field label="Presentación">
              <Input value={f.presentation} onChange={set("presentation")} placeholder="Ej. 100 ml, 1 L, Sobre 10 g" />
            </Field>
            <Field label="Categoría">
              <NativeSelect value={f.category_id} onChange={set("category_id")}>
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Costo" hint="Lo que te cuesta. Solo lo ve la administradora.">
              <MoneyInput value={f.cost} onChange={set("cost")} placeholder="0.00" />
            </Field>
            <Field label="Precio de venta" hint={margin != null ? <span className={margin < 0 ? "text-danger" : "text-accent"}>Margen {margin.toFixed(1)}% · Ganancia {rd(price - (cost ?? 0))}</span> : "Deja en 0 si aún no lo tienes"}>
              <MoneyInput value={f.price} onChange={set("price")} placeholder="0.00" />
            </Field>
            <Field label={isNew ? "Stock inicial" : "Stock actual"} hint={isNew ? undefined : "Para cambiar el stock usa Inventario → Entrada o Ajuste"}>
              <Input type="number" inputMode="decimal" step="0.01" value={f.stock} onChange={set("stock")} disabled={!isNew} placeholder="0" className="num" />
            </Field>
            <Field label="Stock mínimo" hint="Te avisamos cuando quede esta cantidad o menos">
              <Input type="number" inputMode="decimal" step="0.01" value={f.min_stock} onChange={set("min_stock")} className="num" />
            </Field>
            <Field label="Código de barras">
              <Input value={f.barcode} onChange={set("barcode")} placeholder="Escanéalo aquí (opcional)" />
            </Field>
            <Field label="Fecha de vencimiento">
              <Input type="date" value={f.expiry_date} onChange={set("expiry_date")} />
            </Field>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 sm:col-span-2">
              <span>
                <span className="block text-sm font-semibold">Producto activo</span>
                <span className="text-xs text-muted-foreground">Los inactivos no aparecen en la pantalla de venta</span>
              </span>
              <Switch checked={f.active} onCheckedChange={(v) => setF((s) => ({ ...s, active: v }))} />
            </label>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={loading}>{isNew ? "Crear producto" : "Guardar cambios"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
