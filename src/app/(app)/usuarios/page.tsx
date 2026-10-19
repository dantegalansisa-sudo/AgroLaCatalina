"use client";
import * as React from "react";
import { KeyRound, MoreVertical, Plus, ShieldCheck, UserCog, UserRound, Power, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/app/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import type { Profile, Role } from "@/lib/types";
import { cn, displayUser, errorMessage, fmtDate, toLoginEmail } from "@/lib/utils";

function genPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const b = new Uint32Array(12);
  crypto.getRandomValues(b);
  const s = Array.from(b, (x) => a[x % a.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

async function api(method: "POST" | "PATCH", body: unknown) {
  const res = await fetch("/api/admin/users", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Error");
  return json;
}

export default function UsuariosPage() {
  const { profile: me } = useApp();
  const [users, setUsers] = React.useState<Profile[] | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [pwdFor, setPwdFor] = React.useState<Profile | null>(null);

  const load = React.useCallback(async () => {
    const { data, error } = await supabaseBrowser().from("profiles").select("*").order("created_at");
    if (error) toast.error(errorMessage(error));
    setUsers((data ?? []) as Profile[]);
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  async function update(u: Profile, patch: Partial<Pick<Profile, "role" | "active">>) {
    try {
      await api("PATCH", { id: u.id, ...patch });
      toast.success("Usuario actualizado");
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Usuarios" description="Quién puede entrar al sistema y qué puede hacer" actions={<Button onClick={() => setCreateOpen(true)}><Plus /> Nuevo usuario</Button>} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><ShieldCheck className="size-5" /></span>
          <div className="text-sm"><p className="font-bold">Administradora</p><p className="text-muted-foreground">Acceso total: costos, ganancias, reportes, usuarios, anular ventas y configuración.</p></div>
        </Card>
        <Card className="flex gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"><UserRound className="size-5" /></span>
          <div className="text-sm"><p className="font-bold">Cajero</p><p className="text-muted-foreground">Vende, ve productos y stock, maneja clientes/fiado y abre/cierra su caja. No ve costos ni ganancias.</p></div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {!users ? (
          <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : users.length === 0 ? (
          <EmptyState icon={<UserCog />} title="Sin usuarios" />
        ) : (
          <ul className="divide-y divide-border/60">
            {users.map((u) => (
              <li key={u.id} className={cn("flex items-center gap-3 px-4 py-3.5", !u.active && "opacity-60")}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-rose-400 text-xs font-bold text-white">
                  {u.full_name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold">
                    {u.full_name} {u.id === me?.id && <Badge variant="outline">Tú</Badge>} {u.is_demo && <Badge variant="warning">Demo</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">Usuario: <b className="font-semibold text-foreground">{displayUser(u.email)}</b> · desde {fmtDate(u.created_at)}</p>
                </div>
                <Badge variant={u.role === "admin" ? "primary" : "default"}>{u.role === "admin" ? "Administradora" : "Cajero"}</Badge>
                <Badge variant={u.active ? "success" : "danger"} className="hidden sm:inline-flex">{u.active ? "Activo" : "Inactivo"}</Badge>
                <Dropdown>
                  <DropdownTrigger asChild>
                    <button className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><MoreVertical className="size-4" /></button>
                  </DropdownTrigger>
                  <DropdownContent>
                    <DropdownItem onSelect={() => update(u, { role: u.role === "admin" ? "cajero" : "admin" })} disabled={u.id === me?.id}>
                      <UserCog /> Cambiar a {u.role === "admin" ? "cajero" : "administradora"}
                    </DropdownItem>
                    <DropdownItem onSelect={() => setPwdFor(u)}><KeyRound /> Cambiar contraseña</DropdownItem>
                    <DropdownItem onSelect={() => update(u, { active: !u.active })} disabled={u.id === me?.id} danger={u.active}>
                      <Power /> {u.active ? "Desactivar" : "Activar"}
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateUser open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <PasswordDialog user={pwdFor} onClose={() => setPwdFor(null)} />
    </div>
  );
}

function CreateUser({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [f, setF] = React.useState({ full_name: "", email: "", password: "", role: "cajero" as Role });
  const [loading, setLoading] = React.useState(false);
  const [created, setCreated] = React.useState<{ email: string; password: string } | null>(null);
  React.useEffect(() => {
    if (open) {
      setF({ full_name: "", email: "", password: genPassword(), role: "cajero" });
      setCreated(null);
    }
  }, [open]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("POST", f);
      setCreated({ email: displayUser(toLoginEmail(f.email)), password: f.password });
      onCreated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Nuevo usuario" size="md">
        {created ? (
          <>
            <DialogBody>
              <p className="text-sm">Usuario creado. Entrégale estos datos para entrar:</p>
              <div className="space-y-2 rounded-2xl bg-muted/60 p-4 font-mono text-sm">
                <p>Usuario: <b>{created.email}</b></p>
                <p>Contraseña: <b>{created.password}</b></p>
              </div>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(`Correo: ${created.email}\nContraseña: ${created.password}`); toast.success("Copiado"); }}>
                <Copy /> Copiar datos
              </Button>
            </DialogBody>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Listo</Button></DialogFooter>
          </>
        ) : (
          <form onSubmit={save}>
            <DialogBody>
              <Field label="Nombre completo *"><Input autoFocus value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
              <Field label="Usuario *" hint="Una palabra sin espacios ni arroba, ej. maria. Con eso entra al sistema."><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value.toLowerCase().replace(/\s+/g, "") })} placeholder="ej. maria" autoCapitalize="none" /></Field>
              <Field label="Contraseña *" hint="Mínimo 6 caracteres. Puedes escribir una fácil de recordar.">
                <div className="flex gap-2">
                  <Input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="font-mono" />
                  <Button type="button" variant="outline" size="icon" onClick={() => setF({ ...f, password: genPassword() })} aria-label="Generar"><RefreshCw /></Button>
                </div>
              </Field>
              <Field label="Rol">
                <NativeSelect value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
                  <option value="cajero">Cajero</option>
                  <option value="admin">Administradora</option>
                </NativeSelect>
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" loading={loading}>Crear usuario</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ user, onClose }: { user: Profile | null; onClose: () => void }) {
  const [pwd, setPwd] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => setPwd(genPassword()), [user]);
  async function save() {
    if (!user) return;
    setLoading(true);
    try {
      await api("PATCH", { id: user.id, password: pwd });
      toast.success("Contraseña actualizada");
      navigator.clipboard?.writeText(pwd).catch(() => {});
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      {user && (
        <DialogContent title="Cambiar contraseña" description={`Usuario: ${displayUser(user.email)}`} size="sm">
          <DialogBody>
            <Field label="Nueva contraseña" hint="Se copiará al portapapeles al guardar">
              <div className="flex gap-2">
                <Input value={pwd} onChange={(e) => setPwd(e.target.value)} className="font-mono" />
                <Button variant="outline" size="icon" onClick={() => setPwd(genPassword())} aria-label="Generar"><RefreshCw /></Button>
              </div>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} loading={loading} disabled={pwd.length < 6}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
