import { NextResponse } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase/server";
import { toLoginEmail } from "@/lib/utils";

const ROLES = ["admin", "cajero"] as const;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Crear usuario (solo admin) */
export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return bad("No autorizado", 403);
  const body = await req.json().catch(() => null);
  const email = toLoginEmail(String(body?.email ?? ""));
  const password = String(body?.password ?? "");
  const full_name = String(body?.full_name ?? "").trim();
  const role = ROLES.includes(body?.role) ? body.role : "cajero";
  if (!/^[a-z0-9._-]+@\S+\.\S+$/.test(email)) return bad("Usuario inválido: usa solo letras, números, punto o guion");
  if (password.length < 6) return bad("La contraseña debe tener al menos 6 caracteres");
  if (!full_name) return bad("El nombre es obligatorio");

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (error) return bad(/already/i.test(error.message) ? "Ya existe ese usuario" : error.message);
  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id: data.user.id, email, full_name, role, active: true });
  if (pErr) return bad(pErr.message, 500);
  return NextResponse.json({ ok: true, id: data.user.id });
}

/** Actualizar rol / estado / nombre / contraseña (solo admin) */
export async function PATCH(req: Request) {
  const me = await requireAdmin();
  if (!me) return bad("No autorizado", 403);
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return bad("Falta el usuario");
  if (id === me.id && (body.active === false || (body.role && body.role !== "admin"))) {
    return bad("No puedes quitarte el acceso de administradora a ti misma");
  }
  const admin = supabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (ROLES.includes(body.role)) patch.role = body.role;
  if (typeof body.full_name === "string" && body.full_name.trim()) patch.full_name = body.full_name.trim();
  if (Object.keys(patch).length) {
    const { error } = await admin.from("profiles").update(patch).eq("id", id);
    if (error) return bad(error.message, 500);
  }
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 6) return bad("La contraseña debe tener al menos 6 caracteres");
    const { error } = await admin.auth.admin.updateUserById(id, { password: body.password });
    if (error) return bad(error.message, 500);
  }
  if (body.active === false) {
    // cerrar sesiones activas del usuario desactivado
    await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  } else if (body.active === true) {
    await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
  }
  return NextResponse.json({ ok: true });
}
