"use client";
import * as React from "react";
import { FileDown, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SaleFull, Settings } from "@/lib/types";
import { receiptPdf, whatsappUrl } from "@/lib/receipt";
import { cn, errorMessage } from "@/lib/utils";

export function printReceipt(saleId: string) {
  const w = window.open(`/recibo/${saleId}?print=1`, "_blank", "width=420,height=720");
  if (!w) toast.error("Permite las ventanas emergentes para imprimir");
}

export function ReceiptActions({ sale, settings, className, compact }: { sale: SaleFull; settings: Settings | null; className?: string; compact?: boolean }) {
  const [pdfLoading, setPdfLoading] = React.useState(false);
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <Button variant="outline" size={compact ? "sm" : "default"} onClick={() => printReceipt(sale.id)}>
        <Printer /> Imprimir
      </Button>
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        loading={pdfLoading}
        onClick={async () => {
          setPdfLoading(true);
          try {
            await receiptPdf(sale, settings);
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setPdfLoading(false);
          }
        }}
      >
        {!pdfLoading && <FileDown />} PDF
      </Button>
      <Button asChild variant="outline" size={compact ? "sm" : "default"} className="text-[#128C7E] dark:text-[#25D366]">
        <a href={whatsappUrl(sale, settings)} target="_blank" rel="noreferrer">
          <MessageCircle /> WhatsApp
        </a>
      </Button>
    </div>
  );
}
