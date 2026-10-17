"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { CashSession, Category, Product, Profile, Settings } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

interface AppState {
  profile: Profile | null;
  settings: Settings | null;
  isAdmin: boolean;
  loading: boolean;
  categories: Category[];
  products: Product[];
  catalogLoading: boolean;
  cashSession: CashSession | null;
  reloadCatalog: () => Promise<void>;
  reloadSettings: () => Promise<void>;
  reloadCash: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = React.createContext<AppState | null>(null);

export function useApp() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useApp fuera de AppProvider");
  return v;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = React.useState(true);
  const [cashSession, setCashSession] = React.useState<CashSession | null>(null);
  const isAdmin = profile?.role === "admin" && profile.active;

  const reloadSettings = React.useCallback(async () => {
    const { data } = await supabase.from("business_settings").select("*").eq("id", 1).single();
    if (data) setSettings(data as Settings);
  }, [supabase]);

  const reloadCatalog = React.useCallback(async () => {
    const [cats, prods, costs] = await Promise.all([
      supabase.from("categories").select("*").order("sort"),
      supabase.from("products").select("*").order("name"),
      profile?.role === "admin" ? supabase.from("product_costs").select("product_id, cost") : Promise.resolve({ data: [] as { product_id: string; cost: number | null }[], error: null }),
    ]);
    if (cats.error || prods.error) {
      toast.error(errorMessage(cats.error ?? prods.error));
    }
    const costMap = new Map((costs.data ?? []).map((c) => [c.product_id, c.cost]));
    setCategories((cats.data ?? []) as Category[]);
    setProducts(
      ((prods.data ?? []) as Product[]).map((p) => ({
        ...p,
        price: Number(p.price),
        stock: Number(p.stock),
        min_stock: Number(p.min_stock),
        cost: costMap.has(p.id) ? (costMap.get(p.id) == null ? null : Number(costMap.get(p.id))) : null,
      })),
    );
    setCatalogLoading(false);
  }, [supabase, profile?.role]);

  const reloadCash = React.useCallback(async () => {
    const { data } = await supabase.rpc("current_cash_session");
    const s = Array.isArray(data) ? data[0] : data;
    setCashSession(s && s.id ? (s as CashSession) : null);
  }, [supabase]);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [supabase, router]);

  // Carga inicial: perfil + configuración
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (cancelled) return;
      if (!prof || !prof.active) {
        toast.error("Tu usuario está desactivado. Contacta a la administradora.");
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }
      setProfile(prof as Profile);
      await reloadSettings();
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, router, reloadSettings]);

  React.useEffect(() => {
    if (!profile) return;
    reloadCatalog();
    reloadCash();
  }, [profile, reloadCatalog, reloadCash]);

  const value: AppState = {
    profile, settings, isAdmin: !!isAdmin, loading, categories, products, catalogLoading, cashSession,
    reloadCatalog, reloadSettings, reloadCash, signOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
