import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaleFull, Settings } from "./types";
import { PAYMENT_LABEL } from "./types";
import { fmtDateTime, qty, rd, receiptNo, waPhone } from "./utils";

export const SALE_SELECT =
  "*, sale_items(*), sale_payments(*), customer:customers(id,name,phone), seller:profiles!sales_user_id_fkey(id,full_name)";

export async function fetchSale(supabase: SupabaseClient, id: string): Promise<SaleFull | null> {
  const { data, error } = await supabase.from("sales").select(SALE_SELECT).eq("id", id).single();
  if (error) throw error;
  return data as SaleFull;
}

/** Texto plano del recibo para compartir por WhatsApp */
export function receiptText(sale: SaleFull, s: Settings | null) {
  const lines: string[] = [];
  lines.push(`*${s?.name ?? "La Catalina"}*`);
  if (s?.address) lines.push(s.address);
  if (s?.phone) lines.push(`Tel: ${s.phone}`);
  lines.push("");
  lines.push(`*Recibo #${receiptNo(sale.number)}*${sale.status === "anulada" ? " (ANULADO)" : ""}`);
  lines.push(fmtDateTime(sale.created_at));
  if (sale.customer) lines.push(`Cliente: ${sale.customer.name}`);
  lines.push("");
  for (const it of sale.sale_items) {
    lines.push(`${qty(it.quantity)} x ${it.product_name}${it.presentation ? " " + it.presentation : ""}`);
    lines.push(`   ${rd(it.unit_price)} c/u = ${rd(it.line_total)}${Number(it.discount) > 0 ? ` (desc. ${rd(it.discount)})` : ""}`);
  }
  lines.push("");
  const disc = Number(sale.line_discount) + Number(sale.global_discount);
  if (disc > 0) {
    lines.push(`Subtotal: ${rd(sale.subtotal)}`);
    lines.push(`Descuento: -${rd(disc)}`);
  }
  lines.push(`*TOTAL: ${rd(sale.total)}*`);
  for (const p of sale.sale_payments) lines.push(`${PAYMENT_LABEL[p.method]}: ${rd(p.amount)}`);
  if (Number(sale.change_amount) > 0) lines.push(`Cambio: ${rd(sale.change_amount)}`);
  lines.push("");
  if (s?.receipt_message) lines.push(`_${s.receipt_message}_`);
  return lines.join("\n");
}

export function whatsappUrl(sale: SaleFull, s: Settings | null) {
  const phone = waPhone(sale.customer?.phone);
  const text = encodeURIComponent(receiptText(sale, s));
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const data = await new Promise<string>((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as string);
      r.onerror = fail;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((ok) => {
      const img = new Image();
      img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => ok({ w: 1, h: 1 });
      img.src = data;
    });
    return { data, ...dims };
  } catch {
    return null;
  }
}

/** PDF de 80 mm de ancho (formato de ticket) */
export async function receiptPdf(sale: SaleFull, s: Settings | null) {
  const { jsPDF } = await import("jspdf");
  const W = 80;
  const M = 5;
  const lineH = 4.2;
  const estimate = 95 + sale.sale_items.length * 9 + sale.sale_payments.length * 5 + (s?.logo_url ? 22 : 0);
  const doc = new jsPDF({ unit: "mm", format: [W, Math.max(estimate, 120)] });
  let y = 8;
  const center = (t: string, size = 8, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    for (const l of doc.splitTextToSize(t, W - 2 * M)) {
      doc.text(l, W / 2, y, { align: "center" });
      y += size * 0.45;
    }
  };
  const row = (left: string, right: string, bold = false, size = 8) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(left, M, y);
    doc.text(right, W - M, y, { align: "right" });
    y += lineH;
  };
  const dash = () => {
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.setDrawColor(120);
    doc.line(M, y - 1.5, W - M, y - 1.5);
    y += 2.5;
  };

  if (s?.logo_url) {
    const img = await loadImage(s.logo_url);
    if (img) {
      const h = 16;
      const w = Math.min((img.w / img.h) * h, 50);
      doc.addImage(img.data, (W - w) / 2, y - 3, w, h);
      y += h + 2;
    }
  }
  center(s?.name ?? "La Catalina", 10.5, true);
  y += 0.5;
  if (s?.address) center(s.address, 7.5);
  if (s?.phone) center(`Tel: ${s.phone}`, 7.5);
  if (s?.rnc) center(`RNC: ${s.rnc}`, 7.5);
  y += 2;
  dash();
  row(`Recibo #${receiptNo(sale.number)}`, sale.status === "anulada" ? "ANULADO" : "", true, 9);
  row(fmtDateTime(sale.created_at), "", false, 7.5);
  if (sale.seller) row(`Atendido por: ${sale.seller.full_name}`, "", false, 7.5);
  if (sale.customer) row(`Cliente: ${sale.customer.name}`, "", false, 7.5);
  y += 1;
  dash();

  for (const it of sale.sale_items) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const name = doc.splitTextToSize(`${it.product_name}${it.presentation ? " " + it.presentation : ""}`, W - 2 * M);
    for (const l of name) {
      doc.text(l, M, y);
      y += 3.6;
    }
    row(`  ${qty(it.quantity)} x ${rd(it.unit_price)}`, rd(Number(it.line_total) + Number(it.discount)), false, 7.5);
    if (Number(it.discount) > 0) row("  Descuento", `-${rd(it.discount)}`, false, 7.5);
  }
  dash();
  const disc = Number(sale.line_discount) + Number(sale.global_discount);
  if (disc > 0) {
    row("Subtotal", rd(sale.subtotal));
    row("Descuentos", `-${rd(disc)}`);
  }
  y += 0.5;
  row("TOTAL", rd(sale.total), true, 11);
  y += 0.5;
  for (const p of sale.sale_payments) row(PAYMENT_LABEL[p.method], rd(p.amount), false, 7.5);
  if (Number(sale.cash_received) > 0) row("Efectivo recibido", rd(sale.cash_received), false, 7.5);
  if (Number(sale.change_amount) > 0) row("Cambio", rd(sale.change_amount), true, 8);
  if (sale.note) {
    y += 1;
    center(`Nota: ${sale.note}`, 7);
  }
  y += 2;
  dash();
  if (s?.receipt_message) center(s.receipt_message, 7.5);
  y += 1;
  center("Documento no válido como comprobante fiscal", 6);

  doc.save(`recibo-${receiptNo(sale.number)}.pdf`);
}
