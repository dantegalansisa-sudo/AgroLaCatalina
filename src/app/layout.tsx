import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { RegisterSW } from "@/components/app/register-sw";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "La Catalina POS", template: "%s · La Catalina" },
  description: "Punto de venta e inventario — Agro Veterinaria y Ferretería La Catalina, Cabrera.",
  applicationName: "La Catalina POS",
  appleWebApp: { capable: true, title: "La Catalina", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f10" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-DO" suppressHydrationWarning className={jakarta.variable}>
      <body className="min-h-dvh font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors closeButton toastOptions={{ className: "font-sans" }} />
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
