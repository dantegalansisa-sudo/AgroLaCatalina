import { cn } from "@/lib/utils";

/** Marca de La Catalina: hoja + cruz veterinaria sobre rojo de la marca */
export function LogoMark({ className, src }: { className?: string; src?: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="Logo" className={cn("size-10 shrink-0 rounded-xl object-contain", className)} />;
  }
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-md shadow-primary/30", className)}>
      <svg viewBox="0 0 32 32" className="size-[62%]" fill="none" aria-hidden>
        <path d="M7 25c0-9.5 6-16 18-18-1 11.5-7 18-16.5 18H7Z" fill="currentColor" opacity=".95" />
        <path d="M8.5 23.5C12 18 16 14.5 21 11.5" stroke="#c41230" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M21.5 19.5h5M24 17v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({ name = "La Catalina", src, compact }: { name?: string; src?: string | null; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <LogoMark src={src} />
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15px] font-extrabold tracking-tight">{name}</p>
          <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Agro · Vet · Ferretería</p>
        </div>
      )}
    </div>
  );
}
