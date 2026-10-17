// Crea usuarios demo (admin y cajero), 2 clientes y ventas de ejemplo de los últimos 14 días.
// Uso: node scripts/seed-demo.mjs            (no duplica si ya hay ventas demo)
//      node scripts/seed-demo.mjs --new-passwords  (regenera las contraseñas demo)
//      node scripts/seed-demo.mjs --reset    (borra ventas/clientes/cajas, repone stock 10 y regenera relativo a hoy)
// Las contraseñas se generan al azar y se imprimen UNA vez en consola.
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function password() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  let p = "";
  for (const b of bytes) p += alphabet[b % alphabet.length];
  return `${p.slice(0, 4)}-${p.slice(4, 8)}-${p.slice(8)}!`;
}

const users = [
  { email: "admin@lacatalina.demo", full_name: "Catalina (Dueña)", role: "admin" },
  { email: "cajero@lacatalina.demo", full_name: "Cajero Demo", role: "cajero" },
];

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const creds = [];
for (const u of users) {
  let pass = password();
  let id = list.users.find((x) => x.email === u.email)?.id;
  if (id) {
    // usuarios existentes conservan su contraseña salvo que se pida --new-passwords
    if (process.argv.includes("--new-passwords")) {
      const { error } = await admin.auth.admin.updateUserById(id, { password: pass, email_confirm: true });
      if (error) throw error;
    } else pass = "(sin cambios)";
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email, password: pass, email_confirm: true, user_metadata: { full_name: u.full_name },
    });
    if (error) throw error;
    id = data.user.id;
  }
  await db.query(
    `insert into public.profiles (id, email, full_name, role, active, is_demo) values ($1,$2,$3,$4,true,true)
     on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, active = true, is_demo = true`,
    [id, u.email, u.full_name, u.role],
  );
  creds.push({ ...u, id, password: pass });
}

if (process.argv.includes("--reset")) {
  await db.query(fs.readFileSync("supabase/seed/clear_demo.sql", "utf8"));
  await db.query("begin; select set_config('app.stock_ctx','reset',true); update public.products set stock = 10 where true; commit;");
  console.log("Datos demo anteriores borrados; stock repuesto a 10.");
}
await db.query(fs.readFileSync("supabase/seed/demo_data.sql", "utf8"));
await db.end();

console.log("\nUsuarios demo listos:");
for (const c of creds) console.log(`  ${c.role.padEnd(7)} ${c.email}  →  ${c.password}`);
