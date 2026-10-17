import { LogoMark } from "@/components/app/logo";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <LogoMark className="mx-auto size-16 rounded-2xl" />
        <h1 className="mt-6 text-xl font-extrabold tracking-tight">Sin conexión a internet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La Catalina POS necesita internet para registrar ventas y mantener el inventario al día. Revisa el Wi-Fi o los datos y vuelve a intentar.
        </p>
        {/* recarga completa a propósito: puede no haber JS en caché */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white">Reintentar</a>
      </div>
    </div>
  );
}
