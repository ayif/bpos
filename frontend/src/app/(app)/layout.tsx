"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { requiredPermissionFor } from "@/lib/nav";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import LoadingScreen from "@/components/LoadingScreen";
import { ShieldAlert } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return <LoadingScreen />;
  }

  // The Sidebar only hides links the user can't use — it's a convenience, not access
  // control. Anyone could still type the URL directly, so the page itself must also
  // check the same permission before rendering (kept in sync via lib/nav.ts).
  const requiredPerm = requiredPermissionFor(pathname ?? "");
  const allowed = !requiredPerm || can(requiredPerm);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 xl:p-7">
          {allowed ? (
            children
          ) : (
            <div className="card max-w-md mx-auto mt-12 text-center py-10">
              <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <h1 className="font-semibold text-gray-900">Akses Ditolak</h1>
              <p className="text-sm text-gray-500 mt-1">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
