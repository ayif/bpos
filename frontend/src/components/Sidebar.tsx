"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
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
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  perm: string | null;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
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

export default function Sidebar() {
  const pathname = usePathname();
  const { can } = useAuth();

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-200 h-screen sticky top-0 overflow-y-auto flex flex-col">
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg bg-brand-600 flex items-center justify-center shadow-soft shrink-0">
          <ShoppingBag className="h-5 w-5 text-white" strokeWidth={2.25} />
        </div>
        <div className="leading-tight">
          <div className="text-base font-bold text-gray-900">BPOS</div>
          <div className="text-[11px] text-gray-400">Multi Cabang</div>
        </div>
      </div>

      <nav className="px-3 pb-4 flex-1 space-y-5">
        {NAV.map((group) => {
          const items = group.items.filter((item) => !item.perm || can(item.perm));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group.label}</div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                        active ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand-600" : "text-gray-400"}`} strokeWidth={2} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
