import { NextResponse } from "next/server";
import { requireAdmin, supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

/**
 * Limpia los datos demo antes de pasar a producción (solo admin).
 * - Borra ventas, cajas, movimientos, clientes y abonos (función clear_demo_data).
 * - Opcional: pone el stock en 0.
 * - Opcional: elimina los usuarios demo (excepto el usuario actual).
 */
export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const resetStock = body?.resetStock !== false;
  const removeDemoUsers = body?.removeDemoUsers === true;

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("clear_demo_data", { p_reset_stock: resetStock });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let usersRemoved = 0;
  if (removeDemoUsers) {
    const admin = supabaseAdmin();
    const { data: demo } = await admin.from("profiles").select("id").eq("is_demo", true).neq("id", me.id);
    for (const u of demo ?? []) {
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (!delErr) usersRemoved++;
    }
  }
  return NextResponse.json({ ok: true, ...data, users_removed: usersRemoved });
}
