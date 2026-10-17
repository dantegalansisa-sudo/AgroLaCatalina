"use client";
import * as React from "react";
import { Banknote, Calculator, CheckCircle2, HandCoins, Landmark, Lock, Receipt as ReceiptIcon, Wallet, History } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/app/providers";
import { OpenCashForm } from "@/components/app/open-cash";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, MoneyInput, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { EmptyState, PageHeader, Skeleton, Table } from "@/components/ui/misc";
import type { CashSession, CashSummary } from "@/lib/types";
import { cn, errorMessage, fmtDateTime, fmtTime, num, rd } from "@/lib/utils";

const DENOMS = [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1];

function SummaryGrid({ s }: { s: CashSummary }) {
  const rows = [
    { l: "Monto inicial", v: s.opening_amount, icon: Wallet, c: "text-muted-foreground" },
    { l: "Ventas en efectivo", v: s.cash_sales, icon: Banknote, c: "text-accent" },
    { l: "Abonos en efectivo", v: s.cash_payments, icon: HandCoins, c: "text-accent" },
    { l: "Transferencias", v: Number(s.transfer_sales) + Number(s.transfer_payments), icon: Landmark, c: "text-sky-600 dark:text-sky-400" },
    { l: "Vendido fiado", v: s.credit_sales, icon: HandCoins, c: "text-warning" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-muted/50 p-4">
          <p className="text-xs font-semibold text-muted-foreground">Ventas</p>
          <p className="num mt-1 text-2xl font-extrabold">{rd(s.sales_total)}</p>
          <p className="text-xs text-muted-foreground">{s.sales_count} ventas{s.voided_count ? ` · ${s.voided_count} anuladas` : ""}</p>
        </div>
        <div className="rounded-2xl bg-accent-soft p-4">
          <p className="text-xs font-semibold text-accent">Efectivo esperado en caja</p>
          <p className="num mt-1 text-2xl font-extrabold">{rd(s.expected_cash)}</p>
          <p className="text-xs text-muted-foreground">inicial + efectivo</p>
        </div>
      </div>
      <ul className="divide-y divide-border/60 rounded-2xl border border-border">
        {rows.map((r) => (
          <li key={r.l} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <r.icon className={cn("size-4", r.c)} />
            <span className="flex-1 text-muted-foreground">{r.l}</span>
            <span className="num font-semibold">{rd(r.v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CajaPage() {
  const { cashSession, reloadCash, isAdmin, profile } = useApp();
  const [summary, setSummary] = React.useState<CashSummary | null>(null);
  const [counts, setCounts] = React.useState<Record<number, string>>({});
  const [counted, setCounted] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [useCounter, setUseCounter] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [history, setHistory] = React.useState<(CashSession & { user: { full_name: string } | null })[] | null>(null);
  const [detail, setDetail] = React.useState<(CashSession & { user: { full_name: string } | null }) | null>(null);
  const [detailSummary, setDetailSummary] = React.useState<CashSummary | null>(null);

  const loadSummary = React.useCallback(async () => {
    if (!cashSession) return setSummary(null);
    const { data, error } = await supabaseBrowser().rpc("cash_session_summary", { p_session: cashSession.id });
    if (error) toast.error(errorMessage(error));
    else setSummary(data as CashSummary);
  }, [cashSession]);

  const loadHistory = React.useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from("cash_sessions")
      .select("*, user:profiles(full_name)")
      .not("closed_at", "is", null)
      .order("opened_at", { ascending: false })
      .limit(60);
    setHistory((data ?? []) as typeof history);
  }, []);

  React.useEffect(() => {
    loadSummary();
    loadHistory();
  }, [loadSummary, loadHistory]);

  React.useEffect(() => {
    if (!detail) return setDetailSummary(null);
    if (detail.summary) return setDetailSummary(detail.summary);
    supabaseBrowser().rpc("cash_session_summary", { p_session: detail.id }).then(({ data }) => setDetailSummary(data as CashSummary));
  }, [detail]);

  const counterTotal = DENOMS.reduce((a, d) => a + d * num(counts[d]), 0);
  const countedValue = useCounter ? counterTotal : num(counted);
  const diff = summary ? countedValue - Number(summary.expected_cash) : 0;

  async function close() {
    if (!cashSession) return;
    setClosing(true);
    const { error } = await supabaseBrowser().rpc("close_cash_session", { p_session: cashSession.id, p_counted: countedValue, p_notes: notes || null });
    setClosing(false);
    setConfirm(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Caja cerrada correctamente");
    setCounts({});
    setCounted("");
    setNotes("");
    await reloadCash();
    loadHistory();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Caja" description={cashSession ? `Abierta por ${profile?.full_name} desde ${fmtDateTime(cashSession.opened_at)}` : "Apertura y cierre de caja"} />

      {!cashSession ? (
        <div className="py-6"><OpenCashForm onOpened={loadHistory} /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Resumen de la caja" description={`Desde las ${fmtTime(cashSession.opened_at)}`} icon={<span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><ReceiptIcon className="size-[18px]" /></span>} action={<Button variant="ghost" size="sm" onClick={loadSummary}>Actualizar</Button>} />
            <CardBody>{summary ? <SummaryGrid s={summary} /> : <Skeleton className="h-64" />}</CardBody>
          </Card>

          <Card>
            <CardHeader title="Cerrar caja" description="Cuenta el efectivo que hay en la caja" icon={<span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary"><Lock className="size-[18px]" /></span>} />
            <CardBody className="space-y-4">
              <div className="flex gap-2">
                <Button variant={!useCounter ? "soft" : "ghost"} size="sm" onClick={() => setUseCounter(false)}>Monto total</Button>
                <Button variant={useCounter ? "soft" : "ghost"} size="sm" onClick={() => setUseCounter(true)}><Calculator /> Contar billetes</Button>
              </div>
              {useCounter ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                  {DENOMS.map((d) => (
                    <label key={d} className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5">
                      <span className="num w-14 text-xs font-bold text-muted-foreground">{d >= 50 ? "B" : "M"} {d.toLocaleString("es-DO")}</span>
                      <span className="text-xs text-muted-foreground">×</span>
                      <input
                        inputMode="numeric"
                        value={counts[d] ?? ""}
                        onChange={(e) => setCounts({ ...counts, [d]: e.target.value.replace(/\D/g, "") })}
                        className="num h-8 w-full min-w-0 bg-transparent text-right text-sm font-bold outline-none"
                        placeholder="0"
                      />
                    </label>
                  ))}
                  <div className="col-span-2 flex items-center justify-between rounded-xl bg-muted/60 px-4 py-2.5 text-sm">
                    <span className="font-semibold">Total contado</span>
                    <span className="num text-lg font-extrabold">{rd(counterTotal)}</span>
                  </div>
                </div>
              ) : (
                <Field label="Efectivo contado">
                  <MoneyInput value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0.00" className="h-12 text-lg font-bold" />
                </Field>
              )}
              {summary && (counted !== "" || (useCounter && counterTotal > 0)) && (
                <div className={cn("flex items-center justify-between rounded-2xl px-4 py-3", Math.abs(diff) < 0.01 ? "bg-accent-soft text-accent" : diff > 0 ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" : "bg-danger-soft text-danger")}>
                  <span className="text-sm font-bold">{Math.abs(diff) < 0.01 ? "Cuadra perfecto" : diff > 0 ? "Sobrante" : "Faltante"}</span>
                  <span className="num text-xl font-extrabold">{rd(Math.abs(diff))}</span>
                </div>
              )}
              <Field label="Notas del cierre"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones (opcional)" className="min-h-16" /></Field>
              <Button size="lg" className="w-full" onClick={() => setConfirm(true)} disabled={counted === "" && !(useCounter && counterTotal > 0)}>
                <Lock /> Cerrar caja
              </Button>
            </CardBody>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Historial de cierres" description={isAdmin ? "Todas las cajas" : "Tus cajas"} icon={<span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground"><History className="size-[18px]" /></span>} className="pb-4" />
        {!history ? (
          <div className="p-4"><Skeleton className="h-40" /></div>
        ) : history.length === 0 ? (
          <EmptyState title="Aún no hay cierres" />
        ) : (
          <Table>
            <thead>
              <tr><th>Apertura</th><th>Cierre</th>{isAdmin && <th>Usuario</th>}<th className="!text-right">Inicial</th><th className="!text-right">Esperado</th><th className="!text-right">Contado</th><th className="!text-right">Diferencia</th></tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const d = Number(h.difference ?? 0);
                return (
                  <tr key={h.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetail(h)}>
                    <td className="whitespace-nowrap text-xs">{fmtDateTime(h.opened_at)}</td>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">{h.closed_at && fmtTime(h.closed_at)}</td>
                    {isAdmin && <td className="text-xs">{h.user?.full_name}</td>}
                    <td className="num text-right">{rd(h.opening_amount)}</td>
                    <td className="num text-right">{rd(h.expected_cash)}</td>
                    <td className="num text-right font-semibold">{rd(h.counted_cash)}</td>
                    <td className="text-right">
                      <Badge variant={Math.abs(d) < 0.01 ? "success" : d > 0 ? "primary" : "danger"} className="num">{Math.abs(d) < 0.01 ? "Cuadra" : `${d > 0 ? "+" : "-"}${rd(Math.abs(d))}`}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Cerrar la caja?"
        description={<>Efectivo contado: <b className="num">{rd(countedValue)}</b>{summary && <> · {Math.abs(diff) < 0.01 ? "cuadra perfecto" : `${diff > 0 ? "sobrante" : "faltante"} de ${rd(Math.abs(diff))}`}</>}. Después de cerrar ya no podrás vender hasta abrir otra caja.</>}
        confirmLabel="Sí, cerrar caja"
        loading={closing}
        onConfirm={close}
      />

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        {detail && (
          <DialogContent title="Detalle de caja" description={`${detail.user?.full_name ?? ""} · ${fmtDateTime(detail.opened_at)} → ${detail.closed_at ? fmtTime(detail.closed_at) : ""}`}>
            <DialogBody>
              {detailSummary ? <SummaryGrid s={detailSummary} /> : <Skeleton className="h-60" />}
              <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm">
                <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> Contado al cierre</span>
                <span className="num font-bold">{rd(detail.counted_cash)} <span className="text-xs font-semibold text-muted-foreground">({Number(detail.difference) >= 0 ? "+" : ""}{rd(detail.difference)})</span></span>
              </div>
              {detail.notes && <p className="text-sm text-muted-foreground">Notas: {detail.notes}</p>}
            </DialogBody>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
