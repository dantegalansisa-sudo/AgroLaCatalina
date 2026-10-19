# La Catalina POS

Punto de venta e inventario para **Agro Veterinaria y Ferretería La Catalina** — Cabrera, Nagua, República Dominicana · Tel. 809-923-8210.

Reemplaza el registro en papel: ventas, inventario, fiado, caja y reportes, desde la computadora o el teléfono. Uso interno, en línea. *No emite comprobantes fiscales DGII ni procesa tarjetas.*

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4 + componentes estilo shadcn/ui (Radix)
- **Supabase**: Postgres, Auth y Row Level Security
- Recharts (gráficas) · jsPDF (recibos y reportes PDF) · html5-qrcode (escáner con cámara) · PWA instalable
- Moneda RD$ (`es-DO`), zona horaria `America/Santo_Domingo`, interfaz en español

## Módulos

| Módulo | Qué hace |
|---|---|
| Dashboard | Ventas de hoy/semana/mes, ticket promedio, ganancia (admin), más vendidos, stock bajo, próximos a vencer, gráfica de 30 días |
| Vender (POS) | Búsqueda, lector USB y cámara, chips por categoría, carrito, descuento por línea o total, nota, efectivo con cambio, transferencia, fiado y mixto |
| Productos | CRUD, filtros (stock bajo, sin precio, por vencer, inactivos), importar/exportar CSV |
| Inventario | Entradas de mercancía, ajustes con motivo, historial por producto (admin) |
| Clientes | Fiado, abonos, balance, historial, recordatorio por WhatsApp |
| Ventas | Historial con filtros, detalle, reimprimir, PDF, WhatsApp, anular (admin, devuelve stock) |
| Caja | Apertura, resumen en vivo, cierre con conteo de billetes, diferencia, historial |
| Reportes | Por día/semana/mes/rango, categoría, producto y cajero; PDF y CSV (admin) |
| Usuarios | Crear, desactivar, cambiar rol y contraseña (admin) |
| Configuración | Logo, datos del negocio, mensaje del recibo, categorías, limpiar datos demo |

**Atajos:** `Ctrl+K` buscador global · `F2` o `/` buscar en Vender · `F9` o `Ctrl+Enter` cobrar · `Enter` agrega por código de barras.

## Roles

- **admin** (dueña): acceso total, ve costos y ganancias, gestiona usuarios, anula ventas.
- **cajero**: vende, ve productos y stock, maneja clientes/fiado, abre y cierra su caja. No ve costos ni ganancias, no edita precios, solo ve sus propias ventas.

**Entrada sin arroba:** en la pantalla de inicio se escribe solo el *usuario* (ej. `admin`, `cajera`). Internamente se guarda como `usuario@lacatalina.app`, porque Supabase exige un correo; quien tenga un correo real puede entrar con él completo. Al crear usuarios en **Usuarios** también basta con una palabra.

La seguridad está en la base de datos (RLS), no solo en la interfaz:
costos en `product_costs` y `sale_item_costs` (solo admin), ventas y stock modificados únicamente por funciones `SECURITY DEFINER` (`create_sale`, `void_sale`, `inventory_entry`, …) que validan el rol y recalculan precios en el servidor. Todo usuario nuevo nace **inactivo**; solo la administradora lo activa.

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local   # y completa los valores
npm run dev
```

### Variables de entorno

| Variable | Dónde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente + servidor | Clave publicable (respeta RLS) |
| `SUPABASE_SECRET_KEY` | **solo servidor** | Crear/editar usuarios y limpiar demo (`/api/admin/*`) |
| `SUPABASE_DB_URL` | solo scripts locales | Conexión Postgres para migraciones y seed (no hace falta en Vercel) |

## Base de datos

Migraciones versionadas en `supabase/migrations`:

1. `0001_schema.sql` — tablas
2. `0002_auth_rls.sql` — roles, perfil automático, RLS y privilegios
3. `0003_functions.sql` — ventas, anulación, caja, abonos, inventario, dashboard, reportes, limpieza
4. `0004_catalog.sql` — categorías y catálogo real (generado por `scripts/catalog.mjs`)
5. `0005_storage.sql` — bucket del logo

```bash
node scripts/db.mjs supabase/migrations/0001_schema.sql supabase/migrations/0002_auth_rls.sql \
  supabase/migrations/0003_functions.sql supabase/migrations/0004_catalog.sql supabase/migrations/0005_storage.sql
node scripts/seed-demo.mjs            # usuarios demo + clientes + ventas de 14 días
node scripts/seed-demo.mjs --reset    # regenera los datos demo con fechas relativas a hoy
```

## Pasar a producción

Desde **Configuración → Limpiar datos demo** (solo admin), o por consola:

```bash
node scripts/clear-demo.mjs --reset-stock --users
```

Borra ventas, cajas, clientes, abonos y movimientos; conserva productos, precios, costos y categorías. Antes, crea los usuarios reales en **Usuarios**. Recomendado en Supabase → Authentication: desactivar “Allow new users to sign up”.

## Deploy (Vercel)

Importar el repositorio en Vercel (framework Next.js, sin cambios de build) y configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`. En Supabase → Authentication → URL Configuration, agregar el dominio de Vercel como *Site URL*.
