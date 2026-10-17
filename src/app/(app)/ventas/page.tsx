"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ban, Download, Receipt as ReceiptIcon, Search, ShoppingBag, TrendingUp, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/app/providers";
import { DateRangeFilter, presetRange, type Preset } from "@/components/app/date-range";
import { Kpi } from "@/components/app/kpi";
import { Receipt } from "@/components/app/receipt";
import { ReceiptActions } from "@/components/app/receipt-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState, PageHeader, Skeleton, Table } from "@/components/ui/misc";
import { exportCSV } from "@/lib/csv";
import { SALE_SELECT, fetchSale } from "@/lib/receipt";
import type { PaymentMethod, SaleFull } from "@/lib/types";
import { PAYMENT_LABEL } from "@/lib/types";
import { addDays, cn, errorMessage, fmtDateTime, fmtTime, normalize, qty, rd, receiptNo, startOfLocalDay } from "@/lib/utils";

const METHOD_VARIANT: Record<PaymentMethod, "success" | "primary" | "warning"> = { efectivo: "success", transferencia: "primary", fiado: "warning" };

function SalesView() {
  const { isAdmin } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [range, setRange] = React.useState<{ preset: Preset; from: string; to: string }>({ preset: "7d", ...presetRange("7d") });
  const [rows, setRows] = React.useState<SaleFull[] | null>(null);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "completada" | "anulada">("all");
  const [method, setMethod] = React.useState<"all" | PaymentMethod>("all");
  const [seller, setSeller] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(params.get("id"));

  const load = React.useCallback(async () => {
    setRows(null);
    const { data, error } = await supabaseBrowser()
      .from("sales")
      .select(SALE_SELECT)
      .gte("created_at", startOfLocalDay(range.from))
      .lt("created_at", startOfLocalDay(addDays(range.to, 1)))
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast.error(errorMessage(error));
    setRows((data ?? []) as SaleFull[]);
  }, [range.from, range.to]);

  React.useEffect(() => {
    load();
  }, [load]);

  const sellers = Array.from(new Map((rows ?? []).filter((r) => r.seller).map((r) => [r.seller!.id, r.seller!.full_name])).entries());
  const filtered = (rows ?? []).filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (method !== "all" && !s.sale_payments.some((p) => p.method === method)) return false;
    if (seller !== "all" && s.user_id !== seller) return false;
    if (q) {
      const nq = normalize(q.replace(/^#/, ""));
      const hay = normalize(`${receiptNo(s.number)} ${s.number} ${s.customer?.name ?? ""} ${s.sale_items.map((i) => i.product_name).join(" ")}`);
      if (!hay.includes(nq)) return false;
    }
    return true;
  });
  const valid = filtered.filter((s) => s.status === "completada");
  const total = valid.reduce((a, s) => a + Number(s.total), 0);

  function doExport() {
    exportCSV(
      `ventas-${range.from}_${range.to}.csv`,
      filtered.map((s) => ({
        recibo: receiptNo(s.number),
        fecha: fmtDateTime(s.created_at),
        estado: s.status,
        cliente: s.customer?.name ?? "",
        cajero: s.seller?.full_name ?? "",
        articulos: s.sale_items.reduce((a, i) => a + Number(i.quantity), 0),
        subtotal: s.subtotal,
        descuento: Number(s.line_discount) + Number(s.global_discount),
        total: s.total,
        efectivo: s.sale_payments.filter((p) => p.method === "efectivo").reduce((a, p) => a + Number(p.amount), 0),
        transferencia: s.sale_payments.filter((p) => p.method === "transferencia").reduce((a, p) => a + Number(p.amount), 0),
        fiado: s.sale_payments.filter((p) => p.method === "fiado").reduce((a, p) => a + Number(p.amount), 0),
        nota: s.note ?? "",
        motivo_anulacion: s.void_reason ?? "",
      })),
    );
  }

  function openSale(id: string | null) {
    setOpenId(id);
    router.replace(id ? `/ventas?id=${id}` : "/ventas", { scroll: false });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ventas"
        description={isAdmin ? "Historial de todas las ventas" : "Historial de tus ventas"}
        actions={<Button variant="outline" onClick={doExport} disabled={!filtered.length}><Download /> Exportar CSV</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Total vendido" value={rd(total)} icon={<TrendingUp />} />
        <Kpi label="Ventas" value={valid.length} icon={<ShoppingBag />} tone="accent" hint={`${filtered.length - valid.length} anuladas`} />
        <Kpi label="Ticket promedio" value={rd(valid.length ? total / valid.length : 0)} icon={<ReceiptIcon />} tone="sky" className="col-span-2 lg:col-span-1" />
      </div>

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-border/70 p-4">
          <DateRangeFilter value={range} onChange={setRange} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recibo #, cliente o producto…" className="pl-10" />
            </div>
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="lg:w-40">
              <option value="all">Todos los estados</option>
              <option value="completada">Completadas</option>
              <option value="anulada">Anuladas</option>
            </NativeSelect>
            <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="lg:w-44">
              <option value="all">Todos los pagos</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="fiado">Fiado</option>
            </NativeSelect>
            {isAdmin && (
              <NativeSelect value={seller} onChange={(e) => setSeller(e.target.value)} className="lg:w-44">
                <option value="all">Todos los cajeros</option>
                {sellers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </NativeSelect>
            )}
          </div>
        </div>

        {!rows ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ReceiptIcon />} title="No hay ventas en este período" />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <th>Recibo</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    {isAdmin && <th>Cajero</th>}
                    <th>Pago</th>
                    <th className="!text-right">Artículos</th>
                    <th className="!text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} onClick={() => openSale(s.id)} className={cn("cursor-pointer hover:bg-muted/40", s.status === "anulada" && "opacity-60")}>
                      <td className="font-mono text-xs font-bold">#{receiptNo(s.number)}</td>
                      <td className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(s.created_at)}</td>
                      <td className="max-w-[200px] truncate">{s.customer?.name ?? <span className="text-muted-foreground">Mostrador</span>}</td>
                      {isAdmin && <td className="text-xs">{s.seller?.full_name}</td>}
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {s.status === "anulada" ? (
                            <Badge variant="danger"><Ban /> Anulada</Badge>
                          ) : (
                            s.sale_payments.map((p) => <Badge key={p.id} variant={METHOD_VARIANT[p.method]}>{PAYMENT_LABEL[p.method]}</Badge>)
                          )}
                        </div>
                      </td>
                      <td className="num text-right">{qty(s.sale_items.reduce((a, i) => a + Number(i.quantity), 0))}</td>
                      <td className={cn("num text-right font-bold", s.status === "anulada" && "line-through")}>{rd(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <ul className="divide-y divide-border/60 md:hidden">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button onClick={() => openSale(s.id)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", s.status === "anulada" && "opacity-60")}>
                    <span className="grid size-10 place-items-center rounded-xl bg-muted font-mono text-[10px] font-bold">{fmtTime(s.created_at)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">#{receiptNo(s.number)} · {s.customer?.name ?? "Mostrador"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.sale_items.map((i) => i.product_name).join(", ")}</span>
                    </span>
                    <span className="text-right">
                      <span className={cn("num block font-bold", s.status === "anulada" && "line-through")}>{rd(s.total)}</span>
                      {s.status === "anulada" ? <Badge variant="danger">Anulada</Badge> : <Badge variant={METHOD_VARIANT[s.sale_payments[0]?.method ?? "efectivo"]}>{s.sale_payments.length > 1 ? "Mixto" : PAYMENT_LABEL[s.sale_payments[0]?.method ?? "efectivo"]}</Badge>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <SaleDetail id={openId} onClose={() => openSale(null)} onChanged={load} />
    </div>
  );
}

function SaleDetail({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { settings, isAdmin, reloadCatalog } = useApp();
  const [sale, setSale] = React.useState<SaleFull | null>(null);
  const [voidOpen, setVoidOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setSale(null);
    if (!id) return;
    fetchSale(supabaseBrowser(), id).then(setSale).catch((e) => toast.error(errorMessage(e)));
  }, [id]);

  async function doVoid() {
    if (!sale || !reason.trim()) return;
    setLoading(true);
    const { error } = await supabaseBrowser().rpc("void_sale", { p_sale: sale.id, p_reason: reason.trim() });
    setLoading(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Venta anulada. El stock fue devuelto.");
    setVoidOpen(false);
    setReason("");
    setSale(await fetchSale(supabaseBrowser(), sale.id));
    onChanged();
    reloadCatalog();
  }

  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={sale ? `Recibo #${receiptNo(sale.number)}` : "Cargando…"} description={sale ? fmtDateTime(sale.created_at) : undefined} size="lg">
        {!sale ? (
          <DialogBody><Skeleton className="h-64" /></DialogBody>
        ) : (
          <>
            <DialogBody>
              {sale.status === "anulada" && (
                <div className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
                  <XCircle className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="font-bold">Venta anulada {sale.voided_at && `el ${fmtDateTime(sale.voided_at)}`}</p>
                    <p>Motivo: {sale.void_reason}</p>
                  </div>
                </div>
              )}
              <div className="grid gap-5 md:grid-cols-[1fr_auto]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Cliente</p><p className="font-semibold">{sale.customer?.name ?? "Mostrador"}</p></div>
                    <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Atendido por</p><p className="font-semibold">{sale.seller?.full_name}</p></div>
                  </div>
                  <ul className="divide-y divide-border/60 rounded-2xl border border-border">
                    {sale.sale_items.map((it) => (
                      <li key={it.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="num w-8 font-bold text-muted-foreground">{qty(it.quantity)}×</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{it.product_name}</span>
                          <span className="text-xs text-muted-foreground">{it.presentation ? `${it.presentation} · ` : ""}{rd(it.unit_price)}{Number(it.discount) > 0 && ` · desc. ${rd(it.discount)}`}</span>
                        </span>
                        <span className="num font-bold">{rd(it.line_total)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-1 rounded-2xl bg-muted/40 p-4 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="num">{rd(sale.subtotal)}</span></div>
                    {Number(sale.line_discount) + Number(sale.global_discount) > 0 && (
                      <div className="flex justify-between text-accent"><span>Descuentos</span><span className="num">-{rd(Number(sale.line_discount) + Number(sale.global_discount))}</span></div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2 text-base font-extrabold"><span>Total</span><span className="num">{rd(sale.total)}</span></div>
                    {sale.sale_payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-xs text-muted-foreground"><span>{PAYMENT_LABEL[p.method]}{p.reference ? ` · ${p.reference}` : ""}</span><span className="num">{rd(p.amount)}</span></div>
                    ))}
                    {Number(sale.change_amount) > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Cambio entregado</span><span className="num">{rd(sale.change_amount)}</span></div>}
                  </div>
                  {sale.note && <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">Nota: {sale.note}</p>}
                  <ReceiptActions sale={sale} settings={settings} />
                </div>
                <div className="hidden max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-white p-1 md:block">
                  <Receipt sale={sale} settings={settings} className="w-[64mm] text-[10.5px]" />
                </div>
              </div>
            </DialogBody>
            {isAdmin && sale.status === "completada" && (
              <DialogFooter>
                <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setVoidOpen(true)}>
                  <Ban /> Anular venta
                </Button>
              </DialogFooter>
            )}
          </>
        )}
        <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
          <DialogContent title="Anular venta" description="El stock se devuelve y el fiado se descuenta del cliente. Queda registrado." size="sm">
            <DialogBody>
              <Field label="Motivo de la anulación *">
                <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Cliente devolvió el producto" />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setVoidOpen(false)}>Cancelar</Button>
              <Button variant="danger" onClick={doVoid} loading={loading} disabled={!reason.trim()}>Anular venta</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

export default function VentasPage() {
  return (
    <React.Suspense fallback={null}>
      <SalesView />
    </React.Suspense>
  );
}
