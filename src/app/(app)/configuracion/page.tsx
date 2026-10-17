"use client";
import * as React from "react";
import { AlertTriangle, Building2, Download, ImagePlus, Layers, Plus, Save, Smartphone, Trash2, Eraser, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/app/providers";
import { LogoMark } from "@/components/app/logo";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from "@/components/app/category";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/misc";
import { useInstallPrompt } from "@/hooks/use-install";
import type { Category, Settings } from "@/lib/types";
import { cn, errorMessage, num } from "@/lib/utils";

export default function ConfiguracionPage() {
  const { settings, reloadSettings } = useApp();
  return (
    <div className="space-y-5">
      <PageHeader title="Configuración" description="Datos del negocio, recibos, categorías y opciones del sistema" />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          {settings && <BusinessCard settings={settings} onSaved={reloadSettings} />}
          <CategoriesCard />
        </div>
        <div className="space-y-5">
          <InstallCard />
          <DemoCard />
        </div>
      </div>
    </div>
  );
}

function BusinessCard({ settings, onSaved }: { settings: Settings; onSaved: () => Promise<void> }) {
  const [f, setF] = React.useState(settings);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  React.useEffect(() => setF(settings), [settings]);
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setSaving(true);
    const { error } = await supabaseBrowser()
      .from("business_settings")
      .update({
        name: f.name, short_name: f.short_name, address: f.address, phone: f.phone, email: f.email || null, rnc: f.rnc || null,
        receipt_message: f.receipt_message, allow_negative_stock: f.allow_negative_stock, expiry_alert_days: Math.max(1, num(f.expiry_alert_days)),
        logo_url: f.logo_url, updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Configuración guardada");
    onSaved();
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("El logo debe pesar menos de 2 MB");
    setUploading(true);
    const supabase = supabaseBrowser();
    const path = `logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploading(false);
      return toast.error(errorMessage(error));
    }
    const url = supabase.storage.from("branding").getPublicUrl(path).data.publicUrl;
    await supabase.from("business_settings").update({ logo_url: url }).eq("id", 1);
    setF({ ...f, logo_url: url });
    setUploading(false);
    toast.success("Logo actualizado");
    onSaved();
  }

  async function removeLogo() {
    await supabaseBrowser().from("business_settings").update({ logo_url: null }).eq("id", 1);
    setF({ ...f, logo_url: null });
    onSaved();
  }

  return (
    <Card>
      <CardHeader title="Datos del negocio" description="Aparecen en los recibos y en el sistema" icon={<span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary"><Building2 className="size-[18px]" /></span>} />
      <CardBody className="space-y-4">
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border p-4">
          <LogoMark src={f.logo_url} className="size-16 rounded-2xl" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Logo</p>
            <p className="text-xs text-muted-foreground">PNG o JPG, idealmente cuadrado. Se imprime en el recibo.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button asChild variant="outline" size="sm" disabled={uploading}>
              <label className="cursor-pointer"><ImagePlus /> {uploading ? "Subiendo…" : "Subir"}<input type="file" accept="image/*" className="hidden" onChange={upload} /></label>
            </Button>
            {f.logo_url && <Button variant="ghost" size="sm" onClick={removeLogo}>Quitar</Button>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del negocio" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} /></Field>
          <Field label="Nombre corto (menú)"><Input value={f.short_name} onChange={set("short_name")} /></Field>
          <Field label="Teléfono"><Input value={f.phone ?? ""} onChange={set("phone")} /></Field>
          <Field label="Dirección" className="sm:col-span-2"><Input value={f.address ?? ""} onChange={set("address")} /></Field>
          <Field label="Correo (opcional)"><Input value={f.email ?? ""} onChange={set("email")} /></Field>
          <Field label="RNC (opcional)"><Input value={f.rnc ?? ""} onChange={set("rnc")} /></Field>
          <Field label="Mensaje al pie del recibo" className="sm:col-span-2"><Textarea value={f.receipt_message ?? ""} onChange={set("receipt_message")} className="min-h-16" /></Field>
          <Field label="Avisar vencimientos con (días)"><Input type="number" min={1} value={f.expiry_alert_days} onChange={set("expiry_alert_days")} className="num" /></Field>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5 sm:mt-5">
            <span className="text-sm"><span className="block font-semibold">Vender sin stock</span><span className="text-xs text-muted-foreground">Permite stock negativo</span></span>
            <Switch checked={f.allow_negative_stock} onCheckedChange={(v) => setF({ ...f, allow_negative_stock: v })} />
          </label>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}><Save /> Guardar cambios</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function CategoriesCard() {
  const { categories, products, reloadCatalog } = useApp();
  const [editing, setEditing] = React.useState<Partial<Category> | null>(null);
  const [saving, setSaving] = React.useState(false);
  const count = (id: string) => products.filter((p) => p.category_id === id).length;

  async function save() {
    if (!editing?.name?.trim()) return toast.error("El nombre es obligatorio");
    setSaving(true);
    const row = { name: editing.name.trim(), icon: editing.icon ?? "package", color: editing.color ?? "slate", sort: editing.sort ?? categories.length + 1, active: editing.active ?? true };
    const supabase = supabaseBrowser();
    const { error } = editing.id ? await supabase.from("categories").update(row).eq("id", editing.id) : await supabase.from("categories").insert(row);
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Categoría guardada");
    setEditing(null);
    reloadCatalog();
  }

  async function remove(c: Category) {
    if (count(c.id) > 0) return toast.error("No puedes eliminar una categoría con productos. Muévelos primero o desactívala.");
    const { error } = await supabaseBrowser().from("categories").delete().eq("id", c.id);
    if (error) return toast.error(errorMessage(error));
    toast.success("Categoría eliminada");
    reloadCatalog();
  }

  return (
    <Card>
      <CardHeader
        title="Categorías"
        description="Organizan los productos y los filtros del punto de venta"
        icon={<span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><Layers className="size-[18px]" /></span>}
        action={<Button size="sm" variant="outline" onClick={() => setEditing({ icon: "package", color: "slate", active: true })}><Plus /> Nueva</Button>}
      />
      <CardBody>
        <ul className="divide-y divide-border/60 rounded-2xl border border-border">
          {categories.map((c) => (
            <li key={c.id} className={cn("flex items-center gap-3 px-4 py-2.5", !c.active && "opacity-50")}>
              <CategoryIcon category={c} size="sm" />
              <span className="flex-1 text-sm font-semibold">{c.name}</span>
              <span className="text-xs text-muted-foreground">{count(c.id)} productos</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label="Editar"><Pencil /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => remove(c)} aria-label="Eliminar" className="text-muted-foreground hover:text-danger"><Trash2 /></Button>
            </li>
          ))}
        </ul>
      </CardBody>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <DialogContent title={editing.id ? "Editar categoría" : "Nueva categoría"} size="sm">
            <DialogBody>
              <Field label="Nombre"><Input autoFocus value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Ícono">
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(CATEGORY_ICONS).map(([k, Icon]) => (
                    <button key={k} type="button" onClick={() => setEditing({ ...editing, icon: k })} className={cn("grid h-11 place-items-center rounded-xl border-2 transition", editing.icon === k ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                      <Icon className="size-5" />
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Color">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORY_COLORS).map(([k, c]) => (
                    <button key={k} type="button" onClick={() => setEditing({ ...editing, color: k })} className={cn("size-9 rounded-full ring-offset-2 ring-offset-card transition", c.dot, editing.color === k && "ring-2 ring-foreground")} aria-label={k} />
                  ))}
                </div>
              </Field>
              <Field label="Orden"><Input type="number" value={editing.sort ?? ""} onChange={(e) => setEditing({ ...editing, sort: num(e.target.value) })} className="num" /></Field>
              <label className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">
                Activa <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </label>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={save} loading={saving}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}

function InstallCard() {
  const { canInstall, install } = useInstallPrompt();
  return (
    <Card>
      <CardHeader title="Instalar la aplicación" description="Úsala como una app en la computadora o el teléfono" icon={<span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"><Smartphone className="size-[18px]" /></span>} />
      <CardBody className="space-y-3 text-sm">
        {canInstall ? (
          <Button onClick={install} className="w-full"><Download /> Instalar ahora</Button>
        ) : (
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">Si ya está instalada, o tu navegador no muestra el botón, sigue los pasos de abajo.</p>
        )}
        <ul className="space-y-2 text-muted-foreground">
          <li><b className="text-foreground">Computadora (Chrome/Edge):</b> ícono de instalar en la barra de direcciones → “Instalar”.</li>
          <li><b className="text-foreground">Android (Chrome):</b> menú ⋮ → “Instalar aplicación” o “Agregar a pantalla principal”.</li>
          <li><b className="text-foreground">iPhone (Safari):</b> botón Compartir → “Agregar a pantalla de inicio”.</li>
        </ul>
      </CardBody>
    </Card>
  );
}

function DemoCard() {
  const [open, setOpen] = React.useState(false);
  const [resetStock, setResetStock] = React.useState(true);
  const [removeUsers, setRemoveUsers] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { reloadCatalog, reloadCash } = useApp();

  async function run() {
    setLoading(true);
    const res = await fetch("/api/admin/clear-demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resetStock, removeDemoUsers: removeUsers }) });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return toast.error(json.error ?? "Error");
    toast.success(`Listo: ${json.sales_deleted ?? 0} ventas y ${json.customers_deleted ?? 0} clientes eliminados${json.users_removed ? `, ${json.users_removed} usuarios demo` : ""}.`);
    setOpen(false);
    setConfirmText("");
    reloadCatalog();
    reloadCash();
  }

  return (
    <Card className="border-danger/25">
      <CardHeader title="Pasar a producción" description="Elimina los datos de prueba antes de empezar a usarlo de verdad" icon={<span className="grid size-9 place-items-center rounded-xl bg-danger-soft text-danger"><Eraser className="size-[18px]" /></span>} />
      <CardBody className="space-y-3 text-sm">
        <p className="text-muted-foreground">Borra <b className="text-foreground">todas</b> las ventas, cajas, clientes, abonos y movimientos de inventario. Los productos, precios, costos y categorías se conservan.</p>
        <Button variant="danger" className="w-full" onClick={() => setOpen(true)}><Trash2 /> Limpiar datos demo</Button>
      </CardBody>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Limpiar datos demo" description="Esta acción no se puede deshacer" size="sm">
          <DialogBody>
            <div className="flex gap-3 rounded-2xl bg-danger-soft p-3 text-xs text-danger">
              <AlertTriangle className="size-5 shrink-0" />
              Se borrarán ventas, cajas, clientes, abonos y el historial de inventario. Exporta lo que necesites antes.
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5 text-sm">
              <span><span className="block font-semibold">Poner el stock en 0</span><span className="text-xs text-muted-foreground">Para luego cargar el inventario real</span></span>
              <Switch checked={resetStock} onCheckedChange={setResetStock} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5 text-sm">
              <span><span className="block font-semibold">Eliminar usuarios demo</span><span className="text-xs text-muted-foreground">Excepto el tuyo. Crea antes tus usuarios reales.</span></span>
              <Switch checked={removeUsers} onCheckedChange={setRemoveUsers} />
            </label>
            <Field label='Escribe "LIMPIAR" para confirmar'>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="LIMPIAR" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={run} loading={loading} disabled={confirmText.trim().toUpperCase() !== "LIMPIAR"}>Limpiar todo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
