"use client";
import * as React from "react";
import Link from "next/link";
import { HandCoins, MessageCircle, Pencil, Phone, Plus, Search, Trash2, UserRound, Users, Wallet, Receipt as ReceiptIcon, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/app/providers";
import { Kpi } from "@/components/app/kpi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, MoneyInput, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Chip, EmptyState, PageHeader, Segmented, Skeleton } from "@/components/ui/misc";
import type { Customer, PaymentMethod } from "@/lib/types";
import { PAYMENT_LABEL } from "@/lib/types";
import { cn, errorMessage, fmtDateTime, normalize, num, rd, receiptNo, waPhone } from "@/lib/utils";

export default function ClientesPage() {
  const { isAdmin } = useApp();
  const [list, setList] = React.useState<Customer[] | null>(null);
  const [q, setQ] = React.useState("");
  const [onlyDebt, setOnlyDebt] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Customer | null>(null);

  const load = React.useCallback(async () => {
    const { data, error } = await supabaseBrowser().from("customers").select("*").order("name");
    if (error) toast.error(errorMessage(error));
    const rows = ((data ?? []) as Customer[]).map((c) => ({ ...c, balance: Number(c.balance) }));
    setList(rows);
    setSelected((s) => (s ? rows.find((r) => r.id === s.id) ?? null : null));
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = (list ?? [])
    .filter((c) => !onlyDebt || c.balance > 0)
    .filter((c) => !q || normalize(`${c.name} ${c.phone ?? ""}`).includes(normalize(q)));
  const totalDebt = (list ?? []).reduce((a, c) => a + Math.max(c.balance, 0), 0);
  const debtors = (list ?? []).filter((c) => c.balance > 0).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes y fiado"
        description="Ventas a crédito, abonos y balance pendiente"
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Nuevo cliente</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Clientes" value={list?.length ?? "—"} icon={<Users />} tone="sky" />
        <Kpi label="Fiado por cobrar" value={rd(totalDebt)} icon={<HandCoins />} tone="warning" hint={`${debtors} clientes con balance`} />
        <Kpi label="Deuda promedio" value={rd(debtors ? totalDebt / debtors : 0)} icon={<Wallet />} tone="violet" className="col-span-2 lg:col-span-1" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border/70 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono…" className="pl-10" />
          </div>
          <div className="flex gap-2">
            <Chip active={!onlyDebt} onClick={() => setOnlyDebt(false)}>Todos</Chip>
            <Chip active={onlyDebt} onClick={() => setOnlyDebt(true)}><HandCoins /> Con balance</Chip>
          </div>
        </div>
        {!list ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<UserRound />} title="No hay clientes" description="Crea un cliente para venderle fiado y llevar su historial." />
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSelected(c)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-muted/40">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 text-sm font-bold text-sky-800 dark:from-sky-500/20 dark:to-emerald-500/20 dark:text-sky-200">
                    {c.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.phone ?? "Sin teléfono"}{c.address ? ` · ${c.address}` : ""}</span>
                  </span>
                  {c.balance > 0 ? (
                    <span className="text-right">
                      <span className="num block font-extrabold text-warning">{rd(c.balance)}</span>
                      <span className="text-[11px] text-muted-foreground">pendiente</span>
                    </span>
                  ) : (
                    <Badge variant="success">Al día</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CustomerForm open={formOpen} onOpenChange={setFormOpen} customer={editing} onSaved={load} />
      <CustomerDetail
        customer={selected}
        onClose={() => setSelected(null)}
        onEdit={(c) => { setEditing(c); setFormOpen(true); }}
        onChanged={load}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function CustomerForm({ open, onOpenChange, customer, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; customer: Customer | null; onSaved: () => void }) {
  const [f, setF] = React.useState({ name: "", phone: "", address: "", notes: "" });
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (open) setF({ name: customer?.name ?? "", phone: customer?.phone ?? "", address: customer?.address ?? "", notes: customer?.notes ?? "" });
  }, [open, customer]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("El nombre es obligatorio");
    setLoading(true);
    const row = { name: f.name.trim(), phone: f.phone.trim() || null, address: f.address.trim() || null, notes: f.notes.trim() || null };
    const supabase = supabaseBrowser();
    const { error } = customer ? await supabase.from("customers").update(row).eq("id", customer.id) : await supabase.from("customers").insert(row);
    setLoading(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(customer ? "Cliente actualizado" : "Cliente creado");
    onSaved();
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={customer ? "Editar cliente" : "Nuevo cliente"} size="md">
        <form onSubmit={save}>
          <DialogBody>
            <Field label="Nombre *"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nombre y apellido" /></Field>
            <Field label="Teléfono / WhatsApp"><Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="809-000-0000" /></Field>
            <Field label="Dirección"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Sector, finca…" /></Field>
            <Field label="Notas"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ej. Ganadero, paga los viernes" /></Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={loading}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type HistoryItem =
  | { kind: "sale"; id: string; date: string; number: number; total: number; credit: number; status: string }
  | { kind: "payment"; id: string; date: string; amount: number; method: PaymentMethod; note: string | null };

function CustomerDetail({ customer, onClose, onEdit, onChanged, isAdmin }: {
  customer: Customer | null; onClose: () => void; onEdit: (c: Customer) => void; onChanged: () => void; isAdmin: boolean;
}) {
  const { settings, reloadCash } = useApp();
  const [history, setHistory] = React.useState<HistoryItem[] | null>(null);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<"efectivo" | "transferencia">("efectivo");
  const [note, setNote] = React.useState("");
  const [paying, setPaying] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const loadHistory = React.useCallback(async (id: string) => {
    setHistory(null);
    const supabase = supabaseBrowser();
    const [sales, pays] = await Promise.all([
      supabase.from("sales").select("id, number, created_at, total, credit_amount, status").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
      supabase.from("customer_payments").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
    ]);
    const items: HistoryItem[] = [
      ...(sales.data ?? []).map((s) => ({ kind: "sale" as const, id: s.id, date: s.created_at, number: s.number, total: Number(s.total), credit: Number(s.credit_amount), status: s.status })),
      ...(pays.data ?? []).map((p) => ({ kind: "payment" as const, id: p.id, date: p.created_at, amount: Number(p.amount), method: p.method, note: p.note })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));
    setHistory(items);
  }, []);

  React.useEffect(() => {
    if (customer) {
      loadHistory(customer.id);
      setAmount("");
      setNote("");
    }
  }, [customer, loadHistory]);

  async function pay() {
    if (!customer || num(amount) <= 0) return;
    setPaying(true);
    const { error } = await supabaseBrowser().rpc("register_customer_payment", { p_customer: customer.id, p_amount: num(amount), p_method: method, p_note: note || null });
    setPaying(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`Abono de ${rd(num(amount))} registrado`);
    setAmount("");
    setNote("");
    onChanged();
    reloadCash();
    loadHistory(customer.id);
  }

  async function remove() {
    if (!customer) return;
    const { error } = await supabaseBrowser().from("customers").delete().eq("id", customer.id);
    if (error) return toast.error(errorMessage(error));
    toast.success("Cliente eliminado");
    setConfirmDelete(false);
    onClose();
    onChanged();
  }

  const reminder = customer
    ? `Hola ${customer.name.split(" ")[0]}, le saluda ${settings?.name ?? "La Catalina"}. Le recordamos que tiene un balance pendiente de ${rd(customer.balance)}. ¡Gracias por su preferencia!`
    : "";

  return (
    <Dialog open={!!customer} onOpenChange={(v) => !v && onClose()}>
      {customer && (
        <DialogContent title={customer.name} description="Detalle del cliente" size="lg">
          <DialogBody>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {customer.phone && <span className="flex items-center gap-1.5"><Phone className="size-4" /> {customer.phone}</span>}
              {customer.address && <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {customer.address}</span>}
              {customer.notes && <span className="italic">“{customer.notes}”</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
              <div className={cn("rounded-2xl p-4", customer.balance > 0 ? "bg-warning-soft" : "bg-accent-soft")}>
                <p className={cn("text-xs font-semibold", customer.balance > 0 ? "text-warning" : "text-accent")}>Balance pendiente</p>
                <p className="num mt-1 text-3xl font-extrabold">{rd(customer.balance)}</p>
                {customer.balance > 0 && customer.phone && (
                  <Button asChild size="sm" variant="outline" className="mt-3 text-[#128C7E]">
                    <a href={`https://wa.me/${waPhone(customer.phone)}?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noreferrer"><MessageCircle /> Recordar por WhatsApp</a>
                  </Button>
                )}
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-sm font-bold">Registrar abono</p>
                <div className="mt-3 flex gap-2">
                  <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" disabled={customer.balance <= 0} />
                  <Button variant="outline" disabled={customer.balance <= 0} onClick={() => setAmount(String(customer.balance))}>Todo</Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Segmented size="sm" value={method} onChange={setMethod} options={[{ value: "efectivo", label: "Efectivo" }, { value: "transferencia", label: "Transferencia" }]} />
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota" className="h-8 text-xs" />
                </div>
                <Button className="mt-3 w-full" variant="accent" onClick={pay} loading={paying} disabled={num(amount) <= 0}>
                  <HandCoins /> Registrar abono
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Historial</p>
              {!history ? (
                <Skeleton className="h-32" />
              ) : history.length === 0 ? (
                <p className="rounded-xl bg-muted/50 py-6 text-center text-sm text-muted-foreground">Sin movimientos todavía.</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-2xl border border-border">
                  {history.map((h) =>
                    h.kind === "sale" ? (
                      <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <ReceiptIcon className="size-4 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <Link href={`/ventas?id=${h.id}`} className="font-semibold hover:text-primary">Venta #{receiptNo(h.number)}</Link>
                          <span className="block text-xs text-muted-foreground">{fmtDateTime(h.date)}{h.status === "anulada" && " · ANULADA"}</span>
                        </span>
                        <span className="text-right">
                          <span className={cn("num block font-bold", h.status === "anulada" && "line-through opacity-50")}>{rd(h.total)}</span>
                          {h.credit > 0 && <span className="num text-[11px] font-semibold text-warning">Fiado {rd(h.credit)}</span>}
                        </span>
                      </li>
                    ) : (
                      <li key={h.id} className="flex items-center gap-3 bg-accent-soft/40 px-4 py-2.5 text-sm">
                        <HandCoins className="size-4 text-accent" />
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold">Abono · {PAYMENT_LABEL[h.method]}</span>
                          <span className="block truncate text-xs text-muted-foreground">{fmtDateTime(h.date)}{h.note ? ` · ${h.note}` : ""}</span>
                        </span>
                        <span className="num font-bold text-accent">-{rd(h.amount)}</span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          </DialogBody>
          <DialogFooter className="sm:justify-between">
            {isAdmin ? (
              <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)} disabled={customer.balance > 0}>
                <Trash2 /> Eliminar
              </Button>
            ) : <span />}
            <Button variant="outline" onClick={() => onEdit(customer)}><Pencil /> Editar datos</Button>
          </DialogFooter>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="¿Eliminar cliente?"
            description="Se eliminará el cliente y sus abonos. Las ventas quedan en el historial sin cliente asociado."
            confirmLabel="Eliminar"
            danger
            onConfirm={remove}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
