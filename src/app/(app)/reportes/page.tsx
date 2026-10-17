"use client";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Download, FileText, Package, Percent, ShoppingBag, TrendingUp, UserRound, Layers, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/app/providers";
import { DateRangeFilter, presetRange, type Preset } from "@/components/app/date-range";
import { Kpi } from "@/components/app/kpi";
import { categoryStyle } from "@/components/app/category";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Segmented, Skeleton, Table } from "@/components/ui/misc";
import { exportCSV } from "@/lib/csv";
import { addDays, cn, errorMessage, fmtDate, qty, rd } from "@/lib/utils";

interface Row {
  sale_id: string; sale_number: number; sale_date: string; created_at: string; user_id: string; user_name: string | null;
  category_id: string | null; category_name: string; product_id: string | null; product_name: string; presentation: string | null;
  quantity: number; revenue: number; cost: number; has_cost: boolean;
}

type Group = "dia" | "semana" | "mes";

interface Agg { key: string; label: string; revenue: number; cost: number; profit: number; qty: number; sales: Set<string>; costedRevenue: number }

function aggregate(rows: Row[], keyFn: (r: Row) => string, labelFn: (r: Row) => string) {
  const m = new Map<string, Agg>();
  for (const r of rows) {
    const k = keyFn(r);
    let a = m.get(k);
    if (!a) {
      a = { key: k, label: labelFn(r), revenue: 0, cost: 0, profit: 0, qty: 0, sales: new Set(), costedRevenue: 0 };
      m.set(k, a);
    }
    const rev = Number(r.revenue);
    a.revenue += rev;
    a.qty += Number(r.quantity);
    a.sales.add(r.sale_id);
    if (r.has_cost) {
      a.cost += Number(r.cost);
      a.costedRevenue += rev;
      a.profit += rev - Number(r.cost);
    }
  }
  return Array.from(m.values());
}

function weekStart(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
}

function PeriodTooltip({ active, payload }: { active?: boolean; payload?: { payload: Agg }[] }) {
  if (!active || !payload?.length) return null;
  const a = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold text-muted-foreground">{a.label}</p>
      <p className="num mt-0.5 text-sm font-bold">{rd(a.revenue)}</p>
      <p className="text-muted-foreground">{a.sales.size} ventas · ganancia {rd(a.profit)}</p>
    </div>
  );
}

export default function ReportesPage() {
  const { categories, settings } = useApp();
  const [range, setRange] = React.useState<{ preset: Preset; from: string; to: string }>({ preset: "30d", ...presetRange("30d") });
  const [group, setGroup] = React.useState<Group>("dia");
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [pdfLoading, setPdfLoading] = React.useState(false);

  React.useEffect(() => {
    setRows(null);
    supabaseBrowser()
      .rpc("report_items", { p_from: range.from, p_to: range.to })
      .then(({ data, error }) => {
        if (error) toast.error(errorMessage(error));
        setRows((data ?? []) as Row[]);
      });
  }, [range.from, range.to]);

  const r = React.useMemo(() => rows ?? [], [rows]);
  const revenue = r.reduce((a, x) => a + Number(x.revenue), 0);
  const costedRevenue = r.filter((x) => x.has_cost).reduce((a, x) => a + Number(x.revenue), 0);
  const cost = r.filter((x) => x.has_cost).reduce((a, x) => a + Number(x.cost), 0);
  const profit = costedRevenue - cost;
  const salesCount = new Set(r.map((x) => x.sale_id)).size;
  const units = r.reduce((a, x) => a + Number(x.quantity), 0);
  const coverage = revenue ? (costedRevenue / revenue) * 100 : 0;

  const byPeriod = React.useMemo(() => {
    const keyFn = (x: Row) => (group === "dia" ? x.sale_date : group === "semana" ? weekStart(x.sale_date) : x.sale_date.slice(0, 7));
    const labelFn = (x: Row) =>
      group === "dia"
        ? fmtDate(x.sale_date, { weekday: "short", day: "numeric", month: "short" })
        : group === "semana"
          ? `Semana del ${fmtDate(weekStart(x.sale_date), { day: "numeric", month: "short" })}`
          : fmtDate(x.sale_date.slice(0, 7) + "-15", { month: "long", year: "numeric" });
    return aggregate(r, keyFn, labelFn).sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [r, group]);
  const byCategory = React.useMemo(() => aggregate(r, (x) => x.category_id ?? "none", (x) => x.category_name).sort((a, b) => b.revenue - a.revenue), [r]);
  const byProduct = React.useMemo(() => aggregate(r, (x) => `${x.product_name}|${x.presentation ?? ""}`, (x) => `${x.product_name}${x.presentation ? " " + x.presentation : ""}`).sort((a, b) => b.revenue - a.revenue), [r]);
  const byUser = React.useMemo(() => aggregate(r, (x) => x.user_id, (x) => x.user_name ?? "—").sort((a, b) => b.revenue - a.revenue), [r]);

  const toRows = (list: Agg[], label: string) =>
    list.map((a) => ({ [label]: a.label, ventas: a.sales.size, unidades: a.qty, ingresos: a.revenue.toFixed(2), costo: a.cost.toFixed(2), ganancia: a.profit.toFixed(2) }));

  async function exportPdf() {
    setPdfLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const W = doc.internal.pageSize.getWidth();
      doc.setFillColor(196, 18, 48);
      doc.rect(0, 0, W, 70, "F");
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(settings?.name ?? "La Catalina", 40, 32);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Reporte de ventas · ${fmtDate(range.from)} al ${fmtDate(range.to)}`, 40, 50);
      doc.setTextColor(30);
      let y = 100;
      const kpis = [
        ["Ventas", String(salesCount)], ["Ingresos", rd(revenue)], ["Ganancia", rd(profit)], ["Unidades", qty(units)],
      ];
      kpis.forEach(([l, v], i) => {
        const x = 40 + i * ((W - 80) / 4);
        doc.setFontSize(9); doc.setTextColor(110); doc.text(l, x, y);
        doc.setFontSize(13); doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.text(v, x, y + 18); doc.setFont("helvetica", "normal");
      });
      y += 40;
      if (coverage < 99.5) {
        doc.setFontSize(8); doc.setTextColor(150, 90, 0);
        doc.text(`Ganancia calculada sobre el ${coverage.toFixed(0)}% de los ingresos (productos con costo registrado).`, 40, y);
        y += 14;
      }
      const head = [["", "Ventas", "Unidades", "Ingresos", "Costo", "Ganancia"]];
      const body = (list: Agg[]) => list.map((a) => [a.label, String(a.sales.size), qty(a.qty), rd(a.revenue), rd(a.cost), rd(a.profit)]);
      const section = (title: string, list: Agg[]) => {
        autoTable(doc, {
          startY: y + 10,
          head: [[title, ...head[0].slice(1)]],
          body: body(list),
          styles: { fontSize: 8.5, cellPadding: 4 },
          headStyles: { fillColor: [245, 243, 239], textColor: 40, fontStyle: "bold" },
          columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
          margin: { left: 40, right: 40 },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
      };
      section(group === "dia" ? "Por día" : group === "semana" ? "Por semana" : "Por mes", byPeriod);
      section("Por categoría", byCategory);
      section("Por cajero", byUser);
      section("Por producto", byProduct);
      doc.save(`reporte-${range.from}_${range.to}.pdf`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPdfLoading(false);
    }
  }

  const catColor = (id: string) => categoryStyle(categories.find((c) => c.id === id)).bar;
  const maxCat = byCategory[0]?.revenue || 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reportes"
        description="Ventas y ganancias por período, categoría, producto y cajero"
        actions={
          <>
            <Button variant="outline" onClick={() => exportCSV(`reporte-productos-${range.from}_${range.to}.csv`, toRows(byProduct, "producto"))} disabled={!r.length}><Download /> Excel/CSV</Button>
            <Button onClick={exportPdf} loading={pdfLoading} disabled={!r.length}>{!pdfLoading && <FileText />} PDF</Button>
          </>
        }
      />
      <Card className="p-4">
        <DateRangeFilter value={range} onChange={setRange} presets={["hoy", "7d", "semana", "mes", "30d", "mesant"]} />
      </Card>

      {!rows ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label="Ingresos" value={rd(revenue)} icon={<TrendingUp />} hint={`${salesCount} ventas`} />
            <Kpi label="Ganancia" value={rd(profit)} icon={<BarChart3 />} tone="accent" hint={coverage < 99.5 ? `Sobre ${coverage.toFixed(0)}% con costo` : "Ingresos − costo"} />
            <Kpi label="Margen" value={`${costedRevenue ? ((profit / costedRevenue) * 100).toFixed(1) : "0.0"}%`} icon={<Percent />} tone="violet" />
            <Kpi label="Ticket promedio" value={rd(salesCount ? revenue / salesCount : 0)} icon={<ShoppingBag />} tone="sky" hint={`${qty(units)} unidades`} />
          </div>

          {coverage < 99.5 && r.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning-soft p-4 text-sm">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-warning" />
              <p>La ganancia se calcula solo con los productos que tienen <b>costo registrado</b> ({coverage.toFixed(0)}% de los ingresos). Registra los costos en Productos o en Inventario → Entrada para ver la ganancia completa.</p>
            </div>
          )}

          {r.length === 0 ? (
            <Card><EmptyState icon={<BarChart3 />} title="No hay ventas en este período" /></Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title="Ingresos por período"
                  description={`${fmtDate(range.from)} — ${fmtDate(range.to)}`}
                  action={<Segmented size="sm" value={group} onChange={setGroup} options={[{ value: "dia", label: "Día" }, { value: "semana", label: "Semana" }, { value: "mes", label: "Mes" }]} />}
                />
                <CardBody>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byPeriod} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="22%">
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={16} tickFormatter={(v: string) => (group === "dia" ? v.replace(/^\S+\s/, "") : group === "semana" ? v.replace("Semana del ", "") : v)} />
                        <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v))} />
                        <Tooltip content={<PeriodTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
                        <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={44} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Por categoría" icon={<span className="grid size-9 place-items-center rounded-xl bg-muted"><Layers className="size-[18px]" /></span>} action={<Button variant="ghost" size="sm" onClick={() => exportCSV("reporte-categorias.csv", toRows(byCategory, "categoria"))}><Download /></Button>} />
                  <CardBody>
                    <ul className="space-y-3.5">
                      {byCategory.map((c) => (
                        <li key={c.key} className="text-sm">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-semibold">{c.label}</span>
                            <span className="num shrink-0 font-bold">{rd(c.revenue)}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${(c.revenue / maxCat) * 100}%`, background: catColor(c.key) }} />
                            </div>
                            <span className="num w-24 text-right text-[11px] text-muted-foreground">{((c.revenue / (revenue || 1)) * 100).toFixed(0)}% · gan. {rd(c.profit, { short: true })}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>

                <Card className="overflow-hidden">
                  <CardHeader title="Por cajero" icon={<span className="grid size-9 place-items-center rounded-xl bg-muted"><UserRound className="size-[18px]" /></span>} className="pb-4" action={<Button variant="ghost" size="sm" onClick={() => exportCSV("reporte-cajeros.csv", toRows(byUser, "cajero"))}><Download /></Button>} />
                  <Table>
                    <thead><tr><th>Cajero</th><th className="!text-right">Ventas</th><th className="!text-right">Ingresos</th><th className="!text-right">Ticket prom.</th></tr></thead>
                    <tbody>
                      {byUser.map((u) => (
                        <tr key={u.key}>
                          <td className="font-semibold">{u.label}</td>
                          <td className="num text-right">{u.sales.size}</td>
                          <td className="num text-right font-bold">{rd(u.revenue)}</td>
                          <td className="num text-right text-muted-foreground">{rd(u.revenue / (u.sales.size || 1))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
              </div>

              <Card className="overflow-hidden">
                <CardHeader title="Por producto" description={`${byProduct.length} productos vendidos`} icon={<span className="grid size-9 place-items-center rounded-xl bg-muted"><Package className="size-[18px]" /></span>} className="pb-4" action={<Button variant="ghost" size="sm" onClick={() => exportCSV("reporte-productos.csv", toRows(byProduct, "producto"))}><Download /></Button>} />
                <Table>
                  <thead><tr><th>#</th><th>Producto</th><th className="!text-right">Unidades</th><th className="!text-right">Ingresos</th><th className="!text-right">Costo</th><th className="!text-right">Ganancia</th><th className="!text-right">% del total</th></tr></thead>
                  <tbody>
                    {byProduct.map((p, i) => (
                      <tr key={p.key} className="hover:bg-muted/40">
                        <td className="num text-xs text-muted-foreground">{i + 1}</td>
                        <td className="max-w-[320px] truncate font-semibold">{p.label}</td>
                        <td className="num text-right">{qty(p.qty)}</td>
                        <td className="num text-right font-bold">{rd(p.revenue)}</td>
                        <td className="num text-right text-muted-foreground">{p.costedRevenue ? rd(p.cost) : "—"}</td>
                        <td className={cn("num text-right", p.costedRevenue ? "font-semibold text-accent" : "text-muted-foreground")}>{p.costedRevenue ? rd(p.profit) : "Sin costo"}</td>
                        <td className="num text-right text-muted-foreground">{((p.revenue / (revenue || 1)) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
