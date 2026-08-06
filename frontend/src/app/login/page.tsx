"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api";
import { ShoppingBag, Store, Boxes, Calculator, Smartphone } from "lucide-react";

const FEATURES = [
  { icon: Store, text: "POS multi-cabang dengan split payment & retur" },
  { icon: Boxes, text: "Stok FIFO real-time & transfer antar cabang" },
  { icon: Calculator, text: "Akuntansi double-entry otomatis" },
  { icon: Smartphone, text: "PPOB terintegrasi Digiflazz" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@bpos.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-800 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center">
            <ShoppingBag className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <span className="text-lg font-bold">BPOS</span>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            Sistem Point of Sale &amp; Manajemen Multi Cabang
          </h1>
          <p className="text-brand-100 text-sm leading-relaxed">
            Kelola penjualan, stok, pembelian, dan akuntansi seluruh cabang Anda dari satu dasbor terpadu.
          </p>
          <ul className="space-y-3 pt-2">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-brand-50">
                <div className="h-7 w-7 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-3.5 w-3.5" />
                </div>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-200">© {new Date().getFullYear()} BPOS. Internal use.</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-8">
            <div className="h-9 w-9 rounded-lg bg-brand-600 flex items-center justify-center shadow-soft">
              <ShoppingBag className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <span className="text-lg font-bold text-gray-900">BPOS</span>
          </div>

          <div className="mb-7">
            <h2 className="text-xl font-semibold text-gray-900">Masuk ke akun Anda</h2>
            <p className="text-sm text-gray-500 mt-1">Sistem Kasir & Manajemen Multi Cabang</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <div className="mt-6 rounded-lg bg-gray-100 px-3.5 py-3 text-xs text-gray-500 leading-relaxed">
            <span className="font-medium text-gray-600">Demo:</span> admin@bpos.local · manager@bpos.local · kasir@bpos.local
            <br />
            Password: <span className="font-mono">password123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
