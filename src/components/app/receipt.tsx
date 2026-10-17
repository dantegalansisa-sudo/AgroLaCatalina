"use client";
import * as React from "react";
import type { SaleFull, Settings } from "@/lib/types";
import { PAYMENT_LABEL } from "@/lib/types";
import { cn, fmtDateTime, qty, rd, receiptNo } from "@/lib/utils";

/** Recibo con formato de impresora térmica de 80 mm */
export function Receipt({ sale, settings, className }: { sale: SaleFull; settings: Settings | null; className?: string }) {
  const disc = Number(sale.line_discount) + Number(sale.global_discount);
  return (
    <div className={cn("receipt mx-auto w-[72mm] max-w-full bg-white px-1 py-3 font-mono text-[11.5px] leading-snug text-black", className)}>
      <div className="text-center">
        {settings?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logo_url} alt="" className="mx-auto mb-1.5 h-14 object-contain" />
        )}
        <p className="font-sans text-[14px] font-extrabold leading-tight">{settings?.name}</p>
        {settings?.address && <p>{settings.address}</p>}
        {settings?.phone && <p>Tel: {settings.phone}</p>}
        {settings?.rnc && <p>RNC: {settings.rnc}</p>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between font-bold">
        <span>Recibo #{receiptNo(sale.number)}</span>
        {sale.status === "anulada" && <span>ANULADO</span>}
      </div>
      <p>{fmtDateTime(sale.created_at)}</p>
      {sale.seller && <p>Atendido por: {sale.seller.full_name}</p>}
      {sale.customer && <p>Cliente: {sale.customer.name}</p>}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="space-y-1.5">
        {sale.sale_items.map((it) => (
          <div key={it.id}>
            <p className="font-bold">
              {it.product_name} {it.presentation}
            </p>
            <div className="flex justify-between">
              <span>
                {qty(it.quantity)} x {rd(it.unit_price)}
              </span>
              <span>{rd(Number(it.line_total) + Number(it.discount))}</span>
            </div>
            {Number(it.discount) > 0 && (
              <div className="flex justify-between">
                <span>Descuento</span>
                <span>-{rd(it.discount)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      {disc > 0 && (
        <>
          <div className="flex justify-between"><span>Subtotal</span><span>{rd(sale.subtotal)}</span></div>
          <div className="flex justify-between"><span>Descuentos</span><span>-{rd(disc)}</span></div>
        </>
      )}
      <div className="flex justify-between text-[15px] font-bold">
        <span>TOTAL</span>
        <span>{rd(sale.total)}</span>
      </div>
      <div className="mt-1">
        {sale.sale_payments.map((p) => (
          <div key={p.id} className="flex justify-between">
            <span>{PAYMENT_LABEL[p.method]}{p.reference ? ` (${p.reference})` : ""}</span>
            <span>{rd(p.amount)}</span>
          </div>
        ))}
        {Number(sale.cash_received) > 0 && (
          <div className="flex justify-between"><span>Efectivo recibido</span><span>{rd(sale.cash_received)}</span></div>
        )}
        {Number(sale.change_amount) > 0 && (
          <div className="flex justify-between font-bold"><span>Cambio</span><span>{rd(sale.change_amount)}</span></div>
        )}
      </div>
      {sale.note && <p className="mt-2 text-center">Nota: {sale.note}</p>}
      <div className="my-2 border-t border-dashed border-black" />
      {settings?.receipt_message && <p className="text-center">{settings.receipt_message}</p>}
      <p className="mt-1.5 text-center text-[9.5px]">Documento no válido como comprobante fiscal</p>
    </div>
  );
}
