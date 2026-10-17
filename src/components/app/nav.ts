import {
  BarChart3, Boxes, LayoutDashboard, Package, Receipt, Settings, ShoppingCart, Users, UserCog, Wallet, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  mobile?: boolean; // aparece en la barra inferior del teléfono
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/vender", label: "Vender", icon: ShoppingCart, mobile: true },
  { href: "/productos", label: "Productos", icon: Package, mobile: true },
  { href: "/inventario", label: "Inventario", icon: Boxes, adminOnly: true },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/ventas", label: "Ventas", icon: Receipt, mobile: true },
  { href: "/caja", label: "Caja", icon: Wallet },
  { href: "/reportes", label: "Reportes", icon: BarChart3, adminOnly: true },
  { href: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
  { href: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
