import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TZ = "America/Santo_Domingo";

const money = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyShort = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 });
const qtyFmt = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 });

/** RD$ 1,234.50 */
export function rd(value: number | string | null | undefined, opts?: { short?: boolean }) {
  const n = Number(value ?? 0);
  return `RD$ ${(opts?.short ? moneyShort : money).format(Number.isFinite(n) ? n : 0)}`;
}

export function qty(value: number | string | null | undefined) {
  return qtyFmt.format(Number(value ?? 0));
}

export function num(value: unknown) {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function fmtDate(value: string | Date, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00") : new Date(value);
  return new Intl.DateTimeFormat("es-DO", { timeZone: TZ, ...opts }).format(d);
}

export function fmtDateTime(value: string | Date) {
  return fmtDate(value, { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtTime(value: string | Date) {
  return fmtDate(value, { hour: "numeric", minute: "2-digit" });
}

/** Fecha local (Santo Domingo) en formato YYYY-MM-DD */
export function localISODate(d: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts;
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inicio del día local como ISO UTC (para filtros en created_at) */
export function startOfLocalDay(iso: string) {
  // Santo Domingo es UTC-4 todo el año (sin horario de verano)
  return new Date(iso + "T00:00:00-04:00").toISOString();
}

export function daysUntil(iso: string) {
  const today = localISODate();
  return Math.round((new Date(iso + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime()) / 86400000);
}

export function receiptNo(n: number | string) {
  return String(n).padStart(6, "0");
}

/** Normaliza un teléfono dominicano para wa.me (1 + 10 dígitos) */
export function waPhone(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return "1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits || "";
}

export function errorMessage(e: unknown): string {
  if (!e) return "Error desconocido";
  if (typeof e === "string") return e;
  const m = (e as { message?: string }).message ?? String(e);
  if (/JWT|session/i.test(m)) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (/duplicate key.*barcode/i.test(m)) return "Ya existe un producto con ese código de barras.";
  if (/duplicate key/i.test(m)) return "Ya existe un registro con esos datos.";
  if (/permission denied|row-level security/i.test(m)) return "No tienes permiso para esta acción.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión a internet. Intenta de nuevo.";
  return m;
}

export function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function downloadFile(filename: string, content: BlobPart, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Usuarios sin arroba: Supabase necesita un correo, así que un usuario simple
 * como "admin" se guarda internamente como "admin@lacatalina.app".
 * Quien tenga un correo real puede seguir entrando con él.
 */
export const USER_DOMAIN = "lacatalina.app";

export function toLoginEmail(user: string) {
  const u = user.trim().toLowerCase().replace(/\s+/g, "");
  return u.includes("@") ? u : `${u}@${USER_DOMAIN}`;
}

/** Muestra "admin" en lugar de "admin@lacatalina.app" */
export function displayUser(email?: string | null) {
  if (!email) return "";
  return email.toLowerCase().endsWith("@" + USER_DOMAIN) ? email.slice(0, -(USER_DOMAIN.length + 1)) : email;
}
