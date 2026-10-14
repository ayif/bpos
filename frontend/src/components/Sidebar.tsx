"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { NAV } from "@/lib/nav";
import { ShoppingBag, Power } from "lucide-react";

const fetcher = (path: string) => api.get(path);

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();

  // Badge on "Pembelian & Supplier": count of POs waiting on this user's approval.
  const { data: purchaseOrders } = useSWR(can("purchasing.approve") ? "/purchasing/purchase-orders" : null, fetcher);
  const pendingPOCount = purchaseOrders?.filter((o: any) => o.status === "PENDING_APPROVAL").length ?? 0;

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`w-[260px] shrink-0 bg-white border-r border-gray-200 h-screen overflow-y-auto flex flex-col
          fixed inset-y-0 left-0 z-40 transform transition-transform duration-200
          lg:static lg:sticky lg:top-0 lg:translate-x-0 lg:shadow-none
          ${open ? "translate-x-0 shadow-xl" : "-translate-x-full"}`}
      >
      <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-soft shrink-0">
          <ShoppingBag className="h-5 w-5 text-white" strokeWidth={2.25} />
        </div>
        <div className="leading-tight">
          <div className="text-[17px] font-bold tracking-tight text-gray-900">BPOS</div>
          <div className="text-[11px] text-gray-400">POINT OF SALE</div>
        </div>
      </div>

      <nav className="px-3.5 py-5 pb-4 flex-1 space-y-6">
        {NAV.map((group) => {
          const items = group.items.filter((item) => !item.perm || can(item.perm));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="px-2.5 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">{group.label}</div>
              <div className="space-y-1">
                {items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                  const Icon = item.icon;
                  const badge = item.href === "/purchasing" && pendingPOCount > 0 ? pendingPOCount : null;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                        active ? "bg-brand-50 text-brand-700 font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className={`h-[17px] w-[17px] shrink-0 ${active ? "text-brand-600" : "text-gray-400"}`} strokeWidth={1.9} />
                      <span className="truncate">{item.label}</span>
                      {badge && (
                        <span
                          className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            active ? "bg-brand-100 text-brand-700" : "bg-brand-500 text-white"
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="m-3 mt-0 p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
          {initials(user?.name)}
        </div>
        <div className="text-sm leading-tight min-w-0">
          <div className="font-semibold text-gray-900 truncate">{user?.name}</div>
          <div className="text-[11px] text-gray-500 truncate">{user?.role}</div>
        </div>
        <button onClick={logout} className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white shrink-0" title="Keluar">
          <Power className="h-4 w-4" />
        </button>
      </div>
      </aside>
    </>
  );
}
