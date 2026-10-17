"use client";
import * as React from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, ArrowRight, Banknote, CalendarClock, CalendarDays, CalendarRange, HandCoins, Receipt, ShoppingCart, TrendingUp, Wallet, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/app/providers";
import { Kpi } from "@/components/app/kpi";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { cn, daysUntil, errorMessage, fmtDate, qty, rd } from "@/lib/utils";

interface Stats {
  is_admin: boolean;
  today: { total: number; count: number; yesterday_total: number };
  week: { total: number; count: number };
  month: { total: number; count: number };
  profit: { today: number; month: number; missing_costs: boolean; with_cost: boolean } | null;
  series: { date: string; total: number; count: number }[];
  top_products: { name: string; presentation: string | null; qty: number; revenue: number }[];
  payment_mix: Partial<Record<"efectivo" | "transferencia" | "fiado", number>>;
  low_stock: { id: string; name: string; presentation: string | null; stock: number; min_stock: number }[];
  low_stock_count: number;
  expiring: { id: string; name: string; presentation: string | null; expiry_date: string; stock: number }[];
  no_price_count: number;
  credit_total: number;
  customers_count: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { date: string; total: number; count: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold text-muted-foreground">{fmtDate(p.date, { weekday: "short", day: "numeric", month: "short" })}</p>
      <p className="num mt-0.5 text-sm font-bold">{rd(p.total)}</p>
      <p className="text-muted-foreground">{p.count} {p.count === 1 ? "venta" : "ventas"}</p>
    </div>
  );
}

const MIX = [
  { key: "efectivo", label: "Efectivo", color: "var(--accent)" },
  { key: "transferencia", label: "Transferencia", color: "#0284c7" },
  { key: "fiado", label: "Fiado", color: "#d97706" },
] as const;

export default function DashboardPage() {
  const { isAdmin, cashSession } = useApp();
  const [stats, setStats] = React.useState<Stats | null>(null);

  React.useEffect(() => {
    supabaseBrowser()
      .rpc("dashboard_stats")
      .then(({ data, error }) => {
        if (error) toast.error(errorMessage(error));
        else setStats(data as Stats);
      });
  }, []);

  if (!stats) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const n = (v: unknown) => Number(v ?? 0);
  const todayDelta = n(stats.today.yesterday_total) > 0 ? ((n(stats.today.total) - n(stats.today.yesterday_total)) / n(stats.today.yesterday_total)) * 100 : null;
  const avgTicket = stats.month.count ? n(stats.month.total) / stats.month.count : 0;
  const series = stats.series.map((s) => ({ ...s, total: n(s.total) }));
  const last30 = series.reduce((a, s) => a + s.total, 0);
  const mixTotal = MIX.reduce((a, m) => a + n(stats.payment_mix[m.key]), 0);

  return (
    <div className="space-y-5">
      {!cashSession && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/25 bg-warning-soft p-4 sm:flex-row sm:items-center">
          <Wallet className="size-5 shrink-0 text-warning" />
          <p className="flex-1 text-sm font-medium"><b>Tu caja está cerrada.</b> Ábrela con el monto inicial para empezar a vender.</p>
          <Button asChild size="sm" variant="outline"><Link href="/caja">Abrir caja</Link></Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Ventas de hoy" value={rd(stats.today.total)} icon={<Banknote />} delta={todayDelta} hint={todayDelta != null ? "vs. ayer" : `${stats.today.count} ventas`} />
        <Kpi label="Esta semana" value={rd(stats.week.total)} icon={<CalendarDays />} tone="accent" hint={`${stats.week.count} ventas`} />
        <Kpi label="Este mes" value={rd(stats.month.total)} icon={<CalendarRange />} tone="sky" hint={`${stats.month.count} ventas`} />
        {isAdmin && stats.profit ? (
          <Kpi
            label="Ganancia del mes"
            value={rd(stats.profit.month)}
            icon={<TrendingUp />}
            tone="violet"
            hint={!stats.profit.with_cost ? "Registra costos para calcularla" : stats.profit.missing_costs ? "Solo productos con costo" : `Hoy ${rd(stats.profit.today, { short: true })}`}
          />
        ) : (
          <Kpi label="Ticket promedio" value={rd(avgTicket)} icon={<Receipt />} tone="violet" hint="Este mes" />
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Ventas de los últimos 30 días"
            description={`${rd(last30)} en total`}
            action={<Badge variant="success">{stats.today.count} ventas hoy</Badge>}
          />
          <CardBody className="pt-3">
            <div className="h-64 w-full sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 10, right: 6, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(d) => fmtDate(d, { day: "numeric", month: "short" })}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v))}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
                  <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} fill="url(#fillSales)" activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Resumen del mes" description="Cómo te están pagando" />
          <CardBody className="space-y-5">
            <div>
              <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
                {MIX.map((m) => {
                  const v = n(stats.payment_mix[m.key]);
                  return v > 0 ? <div key={m.key} style={{ width: `${(v / (mixTotal || 1)) * 100}%`, background: m.color }} className="h-full first:rounded-l-full last:rounded-r-full" title={`${m.label}: ${rd(v)}`} /> : null;
                })}
              </div>
              <ul className="mt-4 space-y-2.5">
                {MIX.map((m) => {
                  const v = n(stats.payment_mix[m.key]);
                  return (
                    <li key={m.key} className="flex items-center gap-2.5 text-sm">
                      <span className="size-2.5 rounded-full" style={{ background: m.color }} />
                      <span className="flex-1 text-muted-foreground">{m.label}</span>
                      <span className="num font-semibold">{rd(v)}</span>
                      <span className="num w-10 text-right text-xs text-muted-foreground">{mixTotal ? Math.round((v / mixTotal) * 100) : 0}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">Ticket promedio</p>
                <p className="num mt-1 font-bold">{rd(avgTicket)}</p>
              </div>
              <Link href="/clientes" className="rounded-xl bg-warning-soft p-3 transition hover:opacity-90">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-warning"><HandCoins className="size-3.5" /> Fiado pendiente</p>
                <p className="num mt-1 font-bold">{rd(stats.credit_total)}</p>
              </Link>
            </div>
            {stats.no_price_count > 0 && isAdmin && (
              <Link href="/productos?filtro=sinprecio" className="flex items-center gap-2 rounded-xl border border-dashed border-warning/40 px-3 py-2.5 text-xs font-semibold text-warning hover:bg-warning-soft">
                <Tag className="size-4" /> {stats.no_price_count} productos sin precio — completar
                <ArrowRight className="ml-auto size-4" />
              </Link>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Más vendidos" description="Últimos 30 días, por ingreso" icon={<span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary"><ShoppingCart className="size-[18px]" /></span>} />
          <CardBody className="pt-3">
            {stats.top_products.length === 0 ? (
              <EmptyState title="Aún no hay ventas" className="py-8" />
            ) : (
              <ol className="space-y-3">
                {stats.top_products.map((p, i) => {
                  const max = n(stats.top_products[0].revenue) || 1;
                  return (
                    <li key={p.name + p.presentation} className="text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="num w-4 text-xs font-bold text-muted-foreground">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{p.name} <span className="font-normal text-muted-foreground">{p.presentation}</span></span>
                        <span className="num text-xs font-bold">{rd(p.revenue, { short: true })}</span>
                      </div>
                      <div className="ml-6 mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary/80" style={{ width: `${(n(p.revenue) / max) * 100}%` }} />
                        </div>
                        <span className="num w-12 text-right text-[11px] text-muted-foreground">{qty(p.qty)} uds</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Stock bajo"
            description={`${stats.low_stock_count} productos en o bajo el mínimo`}
            icon={<span className="grid size-9 place-items-center rounded-xl bg-warning-soft text-warning"><AlertTriangle className="size-[18px]" /></span>}
            action={<Link href="/productos?filtro=bajo" className="text-xs font-semibold text-primary hover:underline">Ver todos</Link>}
          />
          <CardBody className="pt-3">
            {stats.low_stock.length === 0 ? (
              <EmptyState title="Todo bien surtido" description="Ningún producto está bajo el mínimo." className="py-8" />
            ) : (
              <ul className="divide-y divide-border/60">
                {stats.low_stock.slice(0, 7).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name} <span className="text-muted-foreground">{p.presentation}</span></span>
                    <Badge variant={n(p.stock) <= 0 ? "danger" : "warning"}>{n(p.stock) <= 0 ? "Agotado" : `${qty(p.stock)} / mín ${qty(p.min_stock)}`}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Próximos a vencer"
            description="Revisa y rota estos productos"
            icon={<span className="grid size-9 place-items-center rounded-xl bg-danger-soft text-danger"><CalendarClock className="size-[18px]" /></span>}
          />
          <CardBody className="pt-3">
            {stats.expiring.length === 0 ? (
              <EmptyState title="Sin vencimientos cercanos" className="py-8" />
            ) : (
              <ul className="divide-y divide-border/60">
                {stats.expiring.map((p) => {
                  const d = daysUntil(p.expiry_date);
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name} <span className="text-muted-foreground">{p.presentation}</span></span>
                        <span className="text-xs text-muted-foreground">{fmtDate(p.expiry_date)} · {qty(p.stock)} en stock</span>
                      </span>
                      <Badge variant={d < 0 ? "danger" : d <= 15 ? "warning" : "default"} className={cn(d < 0 && "uppercase")}>
                        {d < 0 ? "Vencido" : d === 0 ? "Hoy" : `${d} días`}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
