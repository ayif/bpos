"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { MapPin, Menu, Bell } from "lucide-react";

const fetcher = (path: string) => api.get(path);

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, activeBranchId, switchBranch, can } = useAuth();

  // Same SWR key as Sidebar's badge fetch — deduped by SWR's cache, no extra request.
  const { data: purchaseOrders } = useSWR(can("purchasing.approve") ? "/purchasing/purchase-orders" : null, fetcher);
  const hasPending = (purchaseOrders?.filter((o: any) => o.status === "PENDING_APPROVAL").length ?? 0) > 0;

  return (
    <header className="h-16 bg-white/80 backdrop-blur border-b border-gray-100 flex items-center px-4 sm:px-6 sticky top-0 z-10">
      <button
        onClick={onMenuClick}
        className="lg:hidden -ml-1.5 p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-3 ml-auto">
        {user && user.branches.length > 1 && (
          <div className="flex items-center gap-1.5 text-gray-500 bg-gray-50 rounded-full px-3 py-1.5">
            <MapPin className="h-3.5 w-3.5" />
            <select
              className="text-xs bg-transparent border-0 font-semibold text-gray-700 focus:outline-none focus:ring-0 cursor-pointer"
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

        <button className="relative h-9 w-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100" title="Notifikasi">
          <Bell className="h-4 w-4" />
          {hasPending && <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />}
        </button>

        <div className="h-9 w-9 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-semibold shrink-0">
          {initials(user?.name)}
        </div>
      </div>
    </header>
  );
}
