"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/misc";
import { addDays, localISODate } from "@/lib/utils";

export type Preset = "hoy" | "ayer" | "7d" | "semana" | "mes" | "30d" | "mesant" | "rango";

export function presetRange(p: Preset): { from: string; to: string } {
  const today = localISODate();
  const d = new Date(today + "T12:00:00Z");
  switch (p) {
    case "hoy": return { from: today, to: today };
    case "ayer": return { from: addDays(today, -1), to: addDays(today, -1) };
    case "7d": return { from: addDays(today, -6), to: today };
    case "30d": return { from: addDays(today, -29), to: today };
    case "semana": {
      const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
      return { from: addDays(today, -dow), to: today };
    }
    case "mes": return { from: today.slice(0, 8) + "01", to: today };
    case "mesant": {
      const first = today.slice(0, 8) + "01";
      const lastPrev = addDays(first, -1);
      return { from: lastPrev.slice(0, 8) + "01", to: lastPrev };
    }
    default: return { from: today, to: today };
  }
}

const LABELS: Record<Exclude<Preset, "rango">, string> = {
  hoy: "Hoy", ayer: "Ayer", "7d": "7 días", semana: "Esta semana", mes: "Este mes", "30d": "30 días", mesant: "Mes anterior",
};

export function DateRangeFilter({ value, onChange, presets = ["hoy", "ayer", "7d", "mes", "30d"] }: {
  value: { preset: Preset; from: string; to: string };
  onChange: (v: { preset: Preset; from: string; to: string }) => void;
  presets?: Exclude<Preset, "rango">[];
}) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {presets.map((p) => (
          <Chip key={p} active={value.preset === p} onClick={() => onChange({ preset: p, ...presetRange(p) })}>{LABELS[p]}</Chip>
        ))}
        <Chip active={value.preset === "rango"} onClick={() => onChange({ ...value, preset: "rango" })}>Rango…</Chip>
      </div>
      {value.preset === "rango" && (
        <div className="flex items-center gap-2">
          <Input type="date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} className="h-9 w-auto" />
          <span className="text-xs text-muted-foreground">a</span>
          <Input type="date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} className="h-9 w-auto" />
        </div>
      )}
    </div>
  );
}
