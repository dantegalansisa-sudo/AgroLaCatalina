// Ejecuta archivos SQL contra la base de datos de Supabase.
// Uso: node scripts/db.mjs supabase/migrations/0001_x.sql [...más archivos]
// Requiere SUPABASE_DB_URL o SUPABASE_DB_PASSWORD (+ NEXT_PUBLIC_SUPABASE_URL) en .env.local
import fs from "node:fs";
import pg from "pg";

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

function connectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const pass = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD);
  return `postgresql://postgres:${pass}@db.${ref}.supabase.co:5432/postgres`;
}

const files = process.argv.slice(2);
const client = new pg.Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  if (!files.length) {
    const r = await client.query("select version()");
    console.log(r.rows[0].version);
  }
  for (const f of files) {
    const sql = fs.readFileSync(f, "utf8");
    process.stdout.write(`→ ${f} ... `);
    await client.query(sql);
    console.log("ok");
  }
} finally {
  await client.end();
}
