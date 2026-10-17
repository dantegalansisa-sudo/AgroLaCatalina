"use client";
import * as React from "react";
import { Camera } from "lucide-react";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";

/** Escáner de códigos con la cámara del teléfono (html5-qrcode) */
export function ScannerDialog({ open, onOpenChange, onDetected }: { open: boolean; onOpenChange: (v: boolean) => void; onDetected: (code: string) => void }) {
  const [error, setError] = React.useState<string | null>(null);
  const regionId = "scanner-region";

  React.useEffect(() => {
    if (!open) return;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let stopped = false;
    let last = "";
    setError(null);
    (async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      // esperar a que el contenedor exista en el DOM
      await new Promise((r) => setTimeout(r, 120));
      if (stopped || !document.getElementById(regionId)) return;
      scanner = new Html5Qrcode(regionId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E, Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF, Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: (w, h) => ({ width: Math.min(w * 0.85, 320), height: Math.min(h * 0.45, 160) }) },
          (text) => {
            if (text === last) return;
            last = text;
            navigator.vibrate?.(60);
            onDetected(text);
            setTimeout(() => (last = ""), 1500);
          },
          () => {},
        );
      } catch {
        setError("No se pudo acceder a la cámara. Revisa los permisos del navegador.");
      }
    })();
    return () => {
      stopped = true;
      if (scanner?.isScanning) scanner.stop().catch(() => {});
    };
  }, [open, onDetected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Escanear código" description="Apunta la cámara al código de barras del producto" size="sm">
        <DialogBody>
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <div id={regionId} className="aspect-[4/3] w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            {error && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white">
                <div>
                  <Camera className="mx-auto mb-2 size-8 opacity-70" />
                  {error}
                </div>
              </div>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">Cada producto detectado se agrega al carrito automáticamente.</p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
