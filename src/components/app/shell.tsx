"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Dialog as D } from "radix-ui";
import {
  Bell, ChevronDown, LogOut, Menu, Moon, Search, Sun, Wallet, X, MoreHorizontal, ShieldCheck, Monitor, AlertTriangle, CalendarClock,
} from "lucide-react";
import { useApp } from "./providers";
import { NAV, isActive } from "./nav";
import { Logo, LogoMark } from "./logo";
import { CommandPalette } from "./command-palette";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Kbd, Skeleton } from "@/components/ui/misc";
import { cn, daysUntil, displayUser, fmtDate, qty } from "@/lib/utils";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Santo_Domingo", hour: "numeric", hour12: false }).format(new Date()));
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isAdmin } = useApp();
  return (
    <nav className="space-y-0.5">
      {NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition",
              active ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <n.icon className={cn("size-[18px]", active ? "" : "text-muted-foreground/80 group-hover:text-foreground")} strokeWidth={2} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function CashPill() {
  const { cashSession } = useApp();
  return (
    <Link
      href="/caja"
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
        cashSession ? "border-accent/20 bg-accent-soft text-accent" : "border-warning/20 bg-warning-soft text-warning",
      )}
    >
      <Wallet className="size-4" />
      <div className="leading-tight">
        <p>{cashSession ? "Caja abierta" : "Caja cerrada"}</p>
        <p className="font-medium opacity-80">{cashSession ? `Desde ${fmtDate(cashSession.opened_at, { hour: "numeric", minute: "2-digit" })}` : "Ábrela para vender"}</p>
      </div>
      <span className={cn("ml-auto size-2 rounded-full", cashSession ? "bg-accent animate-pulse" : "bg-warning")} />
    </Link>
  );
}

function UserMenu({ compact }: { compact?: boolean }) {
  const { profile, signOut } = useApp();
  const { theme, setTheme } = useTheme();
  if (!profile) return <Skeleton className="h-12 w-full" />;
  const initials = profile.full_name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className={cn("flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-muted", compact && "w-auto p-1")}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-rose-400 text-xs font-bold text-white">{initials}</span>
          {!compact && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-bold">{profile.full_name}</span>
                <span className="block text-[11px] font-medium capitalize text-muted-foreground">{profile.role === "admin" ? "Administradora" : "Cajero"}</span>
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-60">
        <DropdownLabel>Usuario: {displayUser(profile.email)}</DropdownLabel>
        <DropdownSeparator />
        <DropdownLabel>Tema</DropdownLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1">
          {[
            { v: "light", icon: Sun, l: "Claro" },
            { v: "dark", icon: Moon, l: "Oscuro" },
            { v: "system", icon: Monitor, l: "Auto" },
          ].map((t) => (
            <button
              key={t.v}
              onClick={() => setTheme(t.v)}
              className={cn("flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition", theme === t.v ? "bg-primary-soft text-primary" : "hover:bg-muted")}
            >
              <t.icon className="size-4" />
              {t.l}
            </button>
          ))}
        </div>
        <DropdownSeparator />
        <DropdownItem onSelect={signOut} danger>
          <LogOut /> Cerrar sesión
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

function Notifications() {
  const { products, settings } = useApp();
  const low = products.filter((p) => p.active && p.stock <= p.min_stock);
  const alertDays = settings?.expiry_alert_days ?? 30;
  const expiring = products.filter((p) => p.active && p.expiry_date && daysUntil(p.expiry_date) <= alertDays).sort((a, b) => (a.expiry_date! < b.expiry_date! ? -1 : 1));
  const count = low.length + expiring.length;
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="relative grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground" aria-label="Alertas">
          <Bell className="size-[18px]" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-background">{count > 99 ? "99+" : count}</span>
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-bold">Alertas</p>
          <p className="text-xs text-muted-foreground">{count === 0 ? "Todo en orden" : `${count} productos requieren atención`}</p>
        </div>
        <div className="scrollbar-thin max-h-80 overflow-y-auto p-1">
          {expiring.slice(0, 8).map((p) => {
            const d = daysUntil(p.expiry_date!);
            return (
              <Link key={"e" + p.id} href="/productos?filtro=vence" className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-muted">
                <CalendarClock className={cn("mt-0.5 size-4 shrink-0", d < 0 ? "text-danger" : "text-warning")} />
                <div className="min-w-0 text-xs">
                  <p className="truncate font-semibold">{p.name} {p.presentation}</p>
                  <p className="text-muted-foreground">{d < 0 ? `Vencido hace ${-d} días` : d === 0 ? "Vence hoy" : `Vence en ${d} días`}</p>
                </div>
              </Link>
            );
          })}
          {low.slice(0, 10).map((p) => (
            <Link key={"l" + p.id} href="/productos?filtro=bajo" className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-muted">
              <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", p.stock <= 0 ? "text-danger" : "text-warning")} />
              <div className="min-w-0 text-xs">
                <p className="truncate font-semibold">{p.name} {p.presentation}</p>
                <p className="text-muted-foreground">{p.stock <= 0 ? "Agotado" : `Quedan ${qty(p.stock)} (mín. ${qty(p.min_stock)})`}</p>
              </div>
            </Link>
          ))}
          {count === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sin alertas de stock ni vencimientos.</p>}
        </div>
      </DropdownContent>
    </Dropdown>
  );
}

function MobileMore({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in" />
        <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-xs flex-col border-r border-border bg-sidebar p-4 shadow-lift outline-none data-[state=open]:animate-in">
          <D.Title className="sr-only">Menú</D.Title>
          <D.Description className="sr-only">Navegación principal</D.Description>
          <div className="mb-5 flex items-center justify-between">
            <Logo />
            <D.Close className="rounded-lg p-2 hover:bg-muted"><X className="size-4" /></D.Close>
          </div>
          <div className="scrollbar-thin -mx-1 flex-1 overflow-y-auto px-1">
            <NavLinks onNavigate={() => onOpenChange(false)} />
          </div>
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <CashPill />
            <UserMenu />
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, profile, settings, isAdmin } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const isPOS = pathname.startsWith("/vender");

  // Proteger rutas de admin
  const current = NAV.find((n) => isActive(pathname, n.href));
  React.useEffect(() => {
    if (!loading && current?.adminOnly && !isAdmin) router.replace("/");
  }, [loading, current, isAdmin, router]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <LogoMark className="size-14 animate-pulse rounded-2xl" />
          <p className="text-sm font-medium text-muted-foreground">Cargando La Catalina…</p>
        </div>
      </div>
    );
  }

  const mobileItems = NAV.filter((n) => n.mobile && (!n.adminOnly || isAdmin));
  const firstName = profile?.full_name.split(" ")[0] ?? "";

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-border/70 bg-sidebar px-4 py-5 lg:flex">
        <div className="mb-7 px-1">
          <Logo name={settings?.short_name ?? "La Catalina"} src={settings?.logo_url} />
        </div>
        <div className="scrollbar-thin -mx-1 flex-1 overflow-y-auto px-1">
          <p className="mb-2 px-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Menú</p>
          <NavLinks />
        </div>
        <div className="mt-4 space-y-3">
          <CashPill />
          {isAdmin && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
              <ShieldCheck className="size-3.5 text-accent" /> Acceso total
            </div>
          )}
          <div className="border-t border-border pt-3">
            <UserMenu />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button className="grid size-10 place-items-center rounded-xl border border-border bg-card lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Menú">
              <Menu className="size-[18px]" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold tracking-tight sm:text-base">
                {greeting()}, {firstName} <span className="inline-block">👋</span>
              </p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })} · {settings?.name}
              </p>
            </div>
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden h-10 w-72 items-center gap-2.5 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground transition hover:border-input md:flex"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">Buscar productos, páginas…</span>
              <Kbd>Ctrl K</Kbd>
            </button>
            <button onClick={() => setPaletteOpen(true)} className="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground md:hidden" aria-label="Buscar">
              <Search className="size-[18px]" />
            </button>
            <Notifications />
            <div className="lg:hidden">
              <UserMenu compact />
            </div>
          </div>
        </header>

        <main className={cn("flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-8", isPOS && "pb-4 lg:pb-4")}>
          <div key={pathname} className="mx-auto w-full max-w-[1500px] animate-in">{children}</div>
        </main>
      </div>

      {/* Barra inferior móvil */}
      {!isPOS && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-5">
            {mobileItems.slice(0, 4).map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold", active ? "text-primary" : "text-muted-foreground")}>
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", active && "bg-primary-soft")}>
                    <n.icon className="size-[19px]" />
                  </span>
                  {n.label}
                </Link>
              );
            })}
            <button onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold text-muted-foreground">
              <span className="grid h-7 w-12 place-items-center"><MoreHorizontal className="size-[19px]" /></span>
              Más
            </button>
          </div>
        </nav>
      )}

      <MobileMore open={menuOpen} onOpenChange={setMenuOpen} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
