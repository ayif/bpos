"use client";

import { useAuth } from "@/lib/auth-context";
import { LogOut, MapPin } from "lucide-react";

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Topbar() {
  const { user, logout, activeBranchId, switchBranch } = useAuth();

  return (
    <header className="h-16 bg-white/80 backdrop-blur border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <div />
      <div className="flex items-center gap-4">
        {user && user.branches.length > 1 && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <MapPin className="h-4 w-4" />
            <select
              className="text-sm bg-transparent border-0 font-medium text-gray-700 focus:outline-none focus:ring-0 cursor-pointer"
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

        <div className="h-6 w-px bg-gray-200" />

        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
            {initials(user?.name)}
          </div>
          <div className="text-sm leading-tight">
            <div className="font-medium text-gray-900">{user?.name}</div>
            <div className="text-xs text-gray-400">{user?.role}</div>
          </div>
        </div>

        <button onClick={logout} className="btn-ghost text-xs" title="Keluar">
          <LogOut className="h-3.5 w-3.5" />
          Keluar
        </button>
      </div>
    </header>
  );
}
