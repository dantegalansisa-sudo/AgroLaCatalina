// Limpia los datos demo antes de pasar a producción.
// Uso:
//   node scripts/clear-demo.mjs                 → borra ventas, cajas, clientes, abonos y movimientos
//   node scripts/clear-demo.mjs --reset-stock   → además pone el stock de todos los productos en 0
//   node scripts/clear-demo.mjs --users         → además elimina los usuarios demo (marcados como demo)
// Requiere SUPABASE_DB_URL (o SUPABASE_DB_PASSWORD) y SUPABASE_SECRET_KEY en .env.local
import fs from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const args = new Set(process.argv.slice(2));

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
await db.query(fs.readFileSync("supabase/seed/clear_demo.sql", "utf8"));
console.log("✓ Ventas, cajas, clientes, abonos y movimientos eliminados");
if (args.has("--reset-stock")) {
  await db.query("begin; select set_config('app.stock_ctx','reset',true); update public.products set stock = 0 where true; commit;");
  console.log("✓ Stock en 0");
}
await db.end();

if (args.has("--users")) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const { data } = await admin.from("profiles").select("id, email").eq("is_demo", true);
  for (const u of data ?? []) {
    await admin.auth.admin.deleteUser(u.id);
    console.log("✓ Usuario eliminado:", u.email);
  }
}
