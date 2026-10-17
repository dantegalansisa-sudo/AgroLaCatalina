"use client";
import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, ChevronRight, Download, Eye, EyeOff, Lock, Mail, MapPin, Monitor, ShoppingCart, Smartphone, Users } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/app/logo";
import { useInstallPrompt } from "@/hooks/use-install";
import fondo from "./fondo.jpg";

const FEATURES = [
  { icon: ShoppingCart, title: "Ventas", sub: "al instante", tone: "bg-emerald-100/80 text-emerald-800" },
  { icon: Boxes, title: "Stock", sub: "siempre al día", tone: "bg-amber-100/80 text-amber-800" },
  { icon: Users, title: "Fiado", sub: "bajo control", tone: "bg-rose-100/80 text-rose-700" },
];

/** Hojas decorativas suaves (esquina del formulario) */
function Leaves({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" className={className} fill="none" aria-hidden>
      <path d="M118 8c40 6 70 30 74 64-38 4-70-14-82-46 2-8 4-14 8-18Z" fill="currentColor" opacity=".55" />
      <path d="M190 96c8 40-10 82-44 104-18-34-10-74 20-98 8-4 16-6 24-6Z" fill="currentColor" opacity=".4" />
      <path d="M150 96c-10 30-34 52-66 56 4-32 28-56 60-60l6 4Z" fill="currentColor" opacity=".3" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [howTo, setHowTo] = React.useState(false);
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
    <div className="flex min-h-dvh flex-col bg-[#faf8f4] text-[#1b1a19] lg:grid lg:grid-cols-[1.18fr_1fr]">
      {/* ===== Portada con foto ===== */}
      <section className="relative h-[38vh] min-h-64 overflow-hidden lg:h-auto lg:min-h-dvh">
        <Image src={fondo} alt="Vaca, caballo, perro y gallo en una finca" fill priority placeholder="blur" sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover object-[35%_40%]" />
        {/* velos para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#faf8f4] via-[#faf8f4]/30 to-transparent lg:from-black/25 lg:via-transparent" />
        {/* arco decorativo rojo */}
        <svg className="pointer-events-none absolute left-[12%] top-[18%] hidden h-[46%] w-[44%] lg:block" viewBox="0 0 400 300" fill="none" aria-hidden>
          <path d="M8 292C20 130 110 20 230 14c80-4 140 40 162 120" stroke="#c41230" strokeWidth="1.6" opacity=".75" />
        </svg>
        <Leaves className="pointer-events-none absolute right-4 top-6 hidden w-36 text-white/70 lg:block" />

        <div className="relative flex h-full flex-col px-6 pb-6 pt-6 sm:px-10 lg:px-[9%] lg:pb-10 lg:pt-14">
          {/* Marca */}
          <div className="flex items-center gap-3 sm:gap-4">
            <LogoMark className="size-12 rounded-2xl shadow-lg shadow-primary/30 sm:size-16 sm:rounded-[1.2rem]" />
            <div className="leading-tight drop-shadow-[0_1px_8px_rgba(255,255,255,.6)]">
              <p className="text-2xl font-extrabold tracking-tight text-[#1b1a19] sm:text-4xl">La Catalina</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#3a3633] sm:text-xs">Agro · Veterinaria · Ferretería</p>
            </div>
          </div>

          {/* Tarjetas de valor */}
          <div className="mt-auto hidden lg:block">
            <div className="grid max-w-3xl grid-cols-3 gap-2.5 xl:gap-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex flex-col items-start gap-2.5 rounded-2xl border border-white/60 bg-white/75 p-3.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,.35)] backdrop-blur-md xl:flex-row xl:items-center xl:gap-3.5 xl:p-5">
                  <span className={`grid size-10 shrink-0 xl:size-12 place-items-center rounded-full ${f.tone}`}>
                    <f.icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 leading-tight">
                    <p className="font-bold">{f.title}</p>
                    <p className="text-[13px] text-[#5d5852] xl:text-sm">{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm font-medium text-white drop-shadow-[0_1px_6px_rgba(0,0,0,.5)]">
              <MapPin className="size-4" /> Cabrera, Nagua · 809-923-8210
            </p>
          </div>
        </div>
      </section>

      {/* ===== Formulario ===== */}
      <section className="relative -mt-8 flex flex-1 flex-col justify-center overflow-hidden rounded-t-[2rem] bg-[#faf8f4] px-6 pb-10 pt-10 sm:px-10 lg:mt-0 lg:rounded-none lg:px-[10%]">
        <Leaves className="pointer-events-none absolute -right-6 -top-4 w-40 text-[#dfe6da] sm:w-52" />
        <div className="relative mx-auto w-full max-w-md">
          <span className="block h-1 w-12 rounded-full bg-primary" />
          <h1 className="mt-6 text-[2rem] font-extrabold leading-tight tracking-tight sm:text-[2.4rem] xl:text-[2.6rem]">Bienvenida de nuevo</h1>
          <p className="mt-2 text-base text-[#6f6b64] sm:text-lg">Inicia sesión para entrar al punto de venta.</p>

          <form onSubmit={onSubmit} className="mt-9 space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm text-[#3a3633]">Correo</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#8a857e]" strokeWidth={1.7} />
                <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 rounded-2xl border-[#e7e3dc] bg-white pl-12 text-[15px] text-[#1b1a19] shadow-[0_1px_2px_rgba(0,0,0,.03)]" placeholder="tu@correo.com" />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-sm text-[#3a3633]">Contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#8a857e]" strokeWidth={1.7} />
                <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 rounded-2xl border-[#e7e3dc] bg-white pl-12 pr-14 text-[15px] text-[#1b1a19] shadow-[0_1px_2px_rgba(0,0,0,.03)]" placeholder="••••••••" />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-[#6f6b64] hover:bg-[#f1efea]" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {show ? <EyeOff className="size-5" strokeWidth={1.7} /> : <Eye className="size-5" strokeWidth={1.7} />}
                </button>
              </div>
            </div>
            <Button type="submit" size="xl" className="group w-full text-base" loading={loading}>
              Entrar {!loading && <ArrowRight className="transition-transform group-hover:translate-x-0.5" />}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => (canInstall ? install() : setHowTo((v) => !v))}
            className="mt-6 flex w-full items-center gap-4 rounded-2xl border border-[#ece8e1] bg-white/70 p-4 text-left transition hover:bg-white hover:shadow-sm"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#e7f2ea] text-[#2f7d52]">
              <Download className="size-5" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Instalar la aplicación</span>
              <span className="block text-sm text-[#6f6b64]">Ábrela desde el escritorio o el teléfono.</span>
            </span>
            <ChevronRight className={`size-5 text-[#8a857e] transition-transform ${howTo ? "rotate-90" : ""}`} />
          </button>
          {howTo && (
            <ul className="mt-2 space-y-1.5 rounded-2xl bg-white/70 px-4 py-3 text-xs text-[#6f6b64]">
              <li><b className="text-[#1b1a19]">Computadora:</b> ícono de instalar en la barra de Chrome o Edge.</li>
              <li><b className="text-[#1b1a19]">Android:</b> menú ⋮ → “Instalar aplicación”.</li>
              <li><b className="text-[#1b1a19]">iPhone:</b> Compartir → “Agregar a pantalla de inicio”.</li>
            </ul>
          )}

          <div className="mt-8 flex items-center gap-3 border-t border-[#ece8e1] pt-6 text-sm text-[#6f6b64]">
            <span className="flex items-center gap-0.5 text-[#8a857e]"><Monitor className="size-5" strokeWidth={1.6} /><Smartphone className="size-4" strokeWidth={1.6} /></span>
            Funciona en computadora y teléfono
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-[#8a857e] lg:hidden">
            <MapPin className="size-3.5" /> Cabrera, Nagua · 809-923-8210
          </p>
        </div>
      </section>
    </div>
  );
}
