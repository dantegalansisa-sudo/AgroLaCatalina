"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, Download, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { LogoMark } from "@/components/app/logo";
import { useInstallPrompt } from "@/hooks/use-install";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const { canInstall, install } = useInstallPrompt();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setLoading(false);
      toast.error(/Invalid login/i.test(error.message) ? "Correo o contraseña incorrectos" : error.message);
      return;
    }
    const { data: prof } = await supabase.from("profiles").select("active").eq("id", data.user.id).single();
    if (!prof?.active) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error("Tu usuario está desactivado. Contacta a la administradora.");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") ? next : "/");
    router.refresh();
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Panel de marca */}
      <div className="relative hidden overflow-hidden bg-[#1a0b0e] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#c41230_0%,transparent_55%),radial-gradient(ellipse_at_bottom_right,#2f7d52_0%,transparent_50%)] opacity-80" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="size-12 bg-white text-primary shadow-none [&_path:nth-child(2)]:stroke-white" />
          <div>
            <p className="text-lg font-extrabold tracking-tight">La Catalina</p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Agro · Veterinaria · Ferretería</p>
          </div>
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="text-4xl font-extrabold leading-[1.1] tracking-tight">Del cuaderno a la nube.</p>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Ventas, inventario, fiado y caja en un solo lugar — desde la computadora o el teléfono.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3 text-sm">
            {[
              ["Ventas", "al instante"],
              ["Stock", "siempre al día"],
              ["Fiado", "bajo control"],
            ].map(([a, b]) => (
              <div key={a} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="font-bold">{a}</p>
                <p className="text-xs text-white/60">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-white/40">Cabrera, Nagua · 809-923-8210</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <LogoMark className="mb-5 size-14 rounded-2xl lg:hidden" />
            <h1 className="text-2xl font-extrabold tracking-tight">Bienvenida de nuevo</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Inicia sesión para entrar al punto de venta.</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Correo</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" placeholder="tu@correo.com" />
              </div>
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10 pr-11" placeholder="••••••••" />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Mostrar contraseña">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Entrar
            </Button>
          </form>
          {canInstall && (
            <button onClick={install} className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left transition hover:bg-muted">
              <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"><Download className="size-5" /></span>
              <span className="text-sm">
                <span className="block font-bold">Instalar la aplicación</span>
                <span className="text-xs text-muted-foreground">Ábrela desde el escritorio o el teléfono</span>
              </span>
            </button>
          )}
          <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground lg:justify-start">
            <Smartphone className="size-3.5" /> Funciona en computadora y teléfono
          </p>
        </div>
      </div>
    </div>
  );
}
