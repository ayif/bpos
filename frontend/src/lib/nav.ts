import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ArrowLeftRight,
  Truck,
  Users,
  Smartphone,
  FileBarChart,
  BookOpenText,
  Receipt,
  Clock,
  Building2,
  UserCog,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  perm: string | null;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Single source of truth for app routes: which permission (if any) each page
// requires. Sidebar uses this to decide what to show; the (app) layout uses
// it to actually block direct URL access to pages a user lacks permission
// for (Sidebar hiding a link is not, by itself, an access control).
export const NAV: NavGroup[] = [
  {
    label: "Utama",
    items: [{ href: "/dashboard", label: "Dashboard", perm: null, icon: LayoutDashboard }],
  },
  {
    label: "Operasional",
    items: [
      { href: "/pos", label: "Kasir (POS)", perm: "pos.sell", icon: ShoppingCart },
      { href: "/products", label: "Produk & Stok", perm: "product.view", icon: Package },
      { href: "/stock", label: "Transfer & Opname", perm: "stock.view", icon: ArrowLeftRight },
      { href: "/purchasing", label: "Pembelian & Supplier", perm: "purchasing.view", icon: Truck },
      { href: "/customers", label: "Pelanggan & Loyalty", perm: "customer.view", icon: Users },
      { href: "/ppob", label: "PPOB", perm: "ppob.view", icon: Smartphone },
      { href: "/shift", label: "Shift Kasir", perm: "shift.manage", icon: Clock },
    ],
  },
  {
    label: "Manajemen",
    items: [
      { href: "/reports", label: "Laporan", perm: "report.view", icon: FileBarChart },
      { href: "/accounting", label: "Akuntansi", perm: "accounting.view", icon: BookOpenText },
      { href: "/expenses", label: "Pengeluaran", perm: "expense.view", icon: Receipt },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/branches", label: "Cabang", perm: "branch.view", icon: Building2 },
      { href: "/users", label: "Pengguna", perm: "user.manage", icon: UserCog },
      { href: "/settings", label: "Pengaturan", perm: "settings.view", icon: Settings },
    ],
  },
];

export const NAV_ITEMS = NAV.flatMap((group) => group.items);

export function requiredPermissionFor(pathname: string): string | null | undefined {
  const item = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return item?.perm;
}
