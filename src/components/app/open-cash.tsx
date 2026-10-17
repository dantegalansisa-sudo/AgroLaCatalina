"use client";
import * as React from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "./providers";
import { Button } from "@/components/ui/button";
import { MoneyInput, Label } from "@/components/ui/input";
import { errorMessage, num } from "@/lib/utils";

export function OpenCashForm({ onOpened }: { onOpened?: () => void }) {
  const { reloadCash } = useApp();
  const [amount, setAmount] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function open(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabaseBrowser().rpc("open_cash_session", { p_opening: num(amount), p_notes: null });
    setLoading(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Caja abierta. ¡Buenas ventas!");
    await reloadCash();
    onOpened?.();
  }

  return (
    <form onSubmit={open} className="mx-auto w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-lift">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Wallet className="size-7" />
      </span>
      <h2 className="mt-4 text-lg font-extrabold tracking-tight">Abre tu caja</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cuenta el efectivo con el que inicias el día.</p>
      <div className="mt-5 text-left">
        <Label>Monto inicial en efectivo</Label>
        <MoneyInput autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-12 text-lg font-bold" />
        <div className="mt-2 flex gap-1.5">
          {[500, 1000, 2000, 5000].map((v) => (
            <button key={v} type="button" onClick={() => setAmount(String(v))} className="num flex-1 rounded-lg bg-muted py-1.5 text-xs font-semibold hover:bg-muted/70">
              {v.toLocaleString("es-DO")}
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" variant="accent" size="lg" className="mt-5 w-full" loading={loading}>
        Abrir caja
      </Button>
    </form>
  );
}
