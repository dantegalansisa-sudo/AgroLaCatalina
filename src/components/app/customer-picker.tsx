"use client";
import * as React from "react";
import { Popover } from "radix-ui";
import { Check, ChevronsUpDown, Plus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Customer } from "@/lib/types";
import { cn, errorMessage, normalize, rd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CustomerPicker({ value, onChange, className }: { value: Customer | null; onChange: (c: Customer | null) => void; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [list, setList] = React.useState<Customer[]>([]);
  const [q, setQ] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    supabaseBrowser()
      .from("customers")
      .select("*")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setList((data ?? []) as Customer[]));
  }, [open]);

  const filtered = list.filter((c) => !q || normalize(`${c.name} ${c.phone ?? ""}`).includes(normalize(q)));

  async function create() {
    if (!q.trim()) return;
    setSaving(true);
    const { data, error } = await supabaseBrowser().from("customers").insert({ name: q.trim(), phone: phone.trim() || null }).select().single();
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    onChange(data as Customer);
    toast.success("Cliente creado");
    setCreating(false);
    setPhone("");
    setQ("");
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={cn("flex items-center gap-1", className)}>
        <Popover.Trigger asChild>
          <button className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-input bg-card px-3 text-left text-sm transition hover:border-primary/40">
            <UserRound className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>{value ? value.name : "Cliente (opcional)"}</span>
            {value && Number(value.balance) > 0 && <span className="num text-[11px] font-semibold text-warning">Debe {rd(value.balance, { short: true })}</span>}
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </Popover.Trigger>
        {value && (
          <button onClick={() => onChange(null)} className="grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Quitar cliente">
            <X className="size-4" />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-72 rounded-xl border border-border bg-popover p-2 shadow-lift data-[state=open]:animate-in">
          <Input autoFocus placeholder="Buscar o escribir nombre…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9" />
          <div className="scrollbar-thin mt-2 max-h-60 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{c.phone ?? "Sin teléfono"}</span>
                </span>
                {Number(c.balance) > 0 && <span className="num text-[11px] font-semibold text-warning">{rd(c.balance, { short: true })}</span>}
                {value?.id === c.id && <Check className="size-4 text-primary" />}
              </button>
            ))}
            {filtered.length === 0 && !creating && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No hay clientes con ese nombre</p>}
          </div>
          {creating ? (
            <div className="mt-2 space-y-2 border-t border-border pt-2">
              <Input placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="h-9" />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => setCreating(false)}>Cancelar</Button>
                <Button size="sm" className="flex-1" loading={saving} onClick={create} disabled={!q.trim()}>Guardar</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              disabled={!q.trim()}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-border px-2.5 pb-1 pt-2.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              <Plus className="size-4" /> {q.trim() ? `Crear cliente “${q.trim()}”` : "Escribe un nombre para crear cliente"}
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
