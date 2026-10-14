"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { NAV } from "@/lib/nav";
import { MapPin, Menu, Bell, Search } from "lucide-react";

const fetcher = (path: string) => api.get(path);

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, activeBranchId, switchBranch, can } = useAuth();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const currentPage = NAV.flatMap((group) => group.items).find((item) => item.href === pathname);
  const searchResults = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return [];
    return NAV.flatMap((group) => group.items)
      .filter((item) => (!item.perm || can(item.perm)) && `${item.label} ${item.href}`.toLowerCase().includes(value))
      .slice(0, 5);
  }, [query, can]);

  // Same SWR key as Sidebar's badge fetch — deduped by SWR's cache, no extra request.
  const { data: purchaseOrders } = useSWR(can("purchasing.approve") ? "/purchasing/purchase-orders" : null, fetcher);
  const hasPending = (purchaseOrders?.filter((o: any) => o.status === "PENDING_APPROVAL").length ?? 0) > 0;

  return (
    <header className="h-[68px] bg-white border-b border-gray-200 flex items-center gap-4 px-4 sm:px-6 sticky top-0 z-20">
      <button
        onClick={onMenuClick}
        className="lg:hidden -ml-1.5 p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden md:block min-w-0">
        <div className="text-[11px] text-gray-400">BPOS / {currentPage?.label ?? "Dashboard"}</div>
        <div className="text-sm font-semibold text-gray-800">{currentPage?.label ?? "Dashboard"}</div>
      </div>

      <div className="relative hidden sm:block ml-auto w-56 lg:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/15 focus:border-brand-300"
          placeholder="Cari halaman..."
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSearchOpen(false);
            if (e.key === "Enter" && searchResults[0]) window.location.href = searchResults[0].href;
          }}
          aria-label="Cari halaman"
        />
        {searchOpen && query.trim() && (
          <>
            <button className="fixed inset-0 z-20 cursor-default" aria-label="Tutup pencarian" onClick={() => setSearchOpen(false)} />
            <div className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
              {searchResults.length ? searchResults.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => { setSearchOpen(false); setQuery(""); }} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700">
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span>{item.label}</span>
                    <span className="ml-auto text-xs text-gray-400">{item.href}</span>
                  </Link>
                );
              }) : <div className="px-3 py-2 text-sm text-gray-500">Tidak ada halaman yang cocok.</div>}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {user && user.branches.length > 1 && (
          <div className="flex items-center gap-1.5 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2">
            <MapPin className="h-3.5 w-3.5" />
            <select
              className="max-w-36 text-xs bg-transparent border-0 font-semibold text-gray-700 focus:outline-none focus:ring-0 cursor-pointer"
              value={activeBranchId ?? ""}
              onChange={(e) => switchBranch(e.target.value)}
            >
              {user.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button className="relative h-10 w-10 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100" title="Notifikasi pembelian">
          <Bell className="h-4 w-4" />
          {hasPending && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
        </button>

        <div className="hidden lg:block text-right leading-tight">
          <div className="text-xs font-semibold text-gray-800">{user?.name}</div>
          <div className="text-[11px] text-gray-400">{user?.role}</div>
        </div>
        <div className="h-10 w-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0" title={user?.name}>
          {initials(user?.name)}
        </div>
      </div>
    </header>
  );
}
