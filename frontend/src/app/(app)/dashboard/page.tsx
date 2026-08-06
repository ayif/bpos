"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";
import { Receipt, Wallet, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

const fetcher = (path: string) => api.get(path);

export default function DashboardPage() {
  const { user, can } = useAuth();
  const { data: salesReport } = useSWR(can("report.view") ? "/reports/sales" : null, fetcher);
  const { data: bestSellers } = useSWR(can("report.view") ? "/reports/best-sellers" : null, fetcher);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Selamat datang, {user?.name}</h1>
        <p className="text-sm text-gray-500">Ringkasan performa toko 30 hari terakhir.</p>
      </div>

      {salesReport && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Transaksi" value={salesReport.transactionCount} icon={Receipt} tone="blue" />
          <StatCard label="Total Penjualan" value={formatCurrency(salesReport.totalSales)} icon={Wallet} tone="brand" />
          <StatCard label="HPP (COGS)" value={formatCurrency(salesReport.totalCogs)} icon={TrendingDown} tone="amber" />
          <StatCard label="Laba Kotor" value={formatCurrency(salesReport.grossProfit)} icon={TrendingUp} tone="green" />
        </div>
      )}

      {bestSellers && (
        <div className="card">
          <h2 className="font-medium text-gray-900 mb-3">Produk Terlaris</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Qty Terjual</th>
                  <th>Pendapatan</th>
                  <th>Laba</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.products.slice(0, 10).map((p: any) => (
                  <tr key={p.productId}>
                    <td className="font-medium text-gray-900">{p.name}</td>
                    <td>{p.qty}</td>
                    <td>{formatCurrency(p.revenue)}</td>
                    <td className="text-green-700">{formatCurrency(p.profit)}</td>
                  </tr>
                ))}
                {bestSellers.products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-400 py-6">
                      Belum ada data penjualan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const TONE_STYLE: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  green: "bg-green-50 text-green-600",
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: keyof typeof TONE_STYLE;
}) {
  return (
    <div className="stat-tile">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-lg font-semibold mt-1 text-gray-900">{value}</div>
      </div>
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${TONE_STYLE[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
