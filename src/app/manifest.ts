import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "La Catalina POS",
    short_name: "La Catalina",
    description: "Punto de venta e inventario — Agro Veterinaria y Ferretería La Catalina",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f5f2",
    theme_color: "#c41230",
    lang: "es-DO",
    categories: ["business", "productivity"],
    icons: [
      { src: "/pwa/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Vender", url: "/vender", icons: [{ src: "/pwa/192", sizes: "192x192" }] },
      { name: "Productos", url: "/productos", icons: [{ src: "/pwa/192", sizes: "192x192" }] },
    ],
  };
}
