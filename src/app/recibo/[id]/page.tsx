"use client";
import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchSale } from "@/lib/receipt";
import type { SaleFull, Settings } from "@/lib/types";
import { Receipt } from "@/components/app/receipt";
import { ReceiptActions } from "@/components/app/receipt-actions";
import { errorMessage } from "@/lib/utils";

function ReceiptView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const [sale, setSale] = React.useState<SaleFull | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const printed = React.useRef(false);

  React.useEffect(() => {
    const supabase = supabaseBrowser();
    Promise.all([fetchSale(supabase, id), supabase.from("business_settings").select("*").eq("id", 1).single()])
      .then(([s, st]) => {
        setSale(s);
        setSettings(st.data as Settings);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  React.useEffect(() => {
    if (!sale || printed.current || search.get("print") !== "1") return;
    printed.current = true;
    const imgs = Array.from(document.images);
    Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => {
      setTimeout(() => window.print(), 250);
    });
  }, [sale, search]);

  if (error) return <p className="p-8 text-center text-sm">{error}</p>;
  if (!sale) return <p className="p-8 text-center text-sm text-neutral-500">Cargando recibo…</p>;

  return (
    <div className="min-h-dvh bg-neutral-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 w-[80mm] max-w-[calc(100%-2rem)]">
        <ReceiptActions sale={sale} settings={settings} compact />
      </div>
      <div className="mx-auto w-[80mm] bg-white shadow-lg print:w-auto print:shadow-none">
        <Receipt sale={sale} settings={settings} />
      </div>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <React.Suspense fallback={null}>
      <ReceiptView />
    </React.Suspense>
  );
}
