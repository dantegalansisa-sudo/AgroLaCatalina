import { ImageResponse } from "next/og";

/** Ícono de la app (PNG) generado con la marca: hoja + cruz sobre rojo */
export function brandIcon(size: number, maskable = false) {
  const inner = maskable ? size * 0.58 : size * 0.64;
  const radius = maskable ? 0 : size * 0.22;
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #d4163a 0%, #a50e27 100%)",
          borderRadius: radius,
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 32 32" fill="none">
          <path d="M7 25c0-9.5 6-16 18-18-1 11.5-7 18-16.5 18H7Z" fill="#ffffff" />
          <path d="M8.5 23.5C12 18 16 14.5 21 11.5" stroke="#c41230" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M21.5 19.5h5M24 17v5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
