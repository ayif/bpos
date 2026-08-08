"use client";

import useSWR from "swr";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { Receipt, Wallet, TrendingDown, TrendingUp, Package, Plus, type LucideIcon } from "lucide-react";
import SalesTrendChart from "@/components/SalesTrendChart";
import PaymentDonut from "@/components/PaymentDonut";

const fetcher = (path: string) => api.get(path);

export default function DashboardPage() {
  const { user, can } = useAuth();
  const { data: salesReport } = useSWR(can("report.view") ? "/reports/sales" : null, fetcher);
  const { data: bestSellers } = useSWR(can("report.view") ? "/reports/best-sellers" : null, fetcher);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Selamat datang, {user?.name}</h1>
        <p className="text-sm text-gray-500">Ringkasan performa toko 30 hari terakhir.</p>
      </div>

      {salesReport && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Transaksi" value={salesReport.transactionCount} icon={Receipt} tone="violet" />
          <StatCard label="Total Penjualan" value={formatCurrency(salesReport.totalSales)} icon={Wallet} tone="sky" />
          <StatCard label="HPP (COGS)" value={formatCurrency(salesReport.totalCogs)} icon={TrendingDown} tone="amber" />
          <StatCard label="Laba Kotor" value={formatCurrency(salesReport.grossProfit)} icon={TrendingUp} tone="mint" />
        </div>
      )}

      {salesReport && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card lg:col-span-2 min-w-0">
            <h2 className="font-semibold text-gray-900 mb-4">Penjualan vs HPP Harian</h2>
            <SalesTrendChart sales={salesReport.sales} />
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                <span className="text-gray-500">Penjualan</span>
                <span className="font-semibold text-gray-900">{formatCurrency(salesReport.totalSales)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
                <span className="text-gray-500">HPP</span>
                <span className="font-semibold text-gray-900">{formatCurrency(salesReport.totalCogs)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 min-w-0">
            <div className="card min-w-0">
              <h2 className="font-semibold text-gray-900 mb-1">Komposisi Pembayaran</h2>
              <p className="text-xs text-gray-400 mb-4">Distribusi metode bayar</p>
              <PaymentDonut breakdown={salesReport.paymentBreakdown ?? {}} />
            </div>

            <div className="card min-w-0">
              <h2 className="font-semibold text-gray-900 mb-3">Transaksi Terbaru</h2>
              <div className="space-y-3">
                {salesReport.sales
                  .slice(-5)
                  .reverse()
                  .map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{s.invoiceNo}</div>
                        <div className="text-xs text-gray-400">{formatDate(s.date)}</div>
                      </div>
                      <div className="text-gray-700 font-medium shrink-0">{formatCurrency(s.grandTotal)}</div>
                    </div>
                  ))}
                {salesReport.sales.length === 0 && <div className="text-sm text-gray-400 py-6 text-center">Belum ada transaksi</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {bestSellers && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Produk Terlaris</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Qty Terjual</th>
                  <th>Pendapatan</th>
                  <th>Laba</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.products.slice(0, 10).map((p: any, i: number) => (
                  <tr key={p.productId}>
                    <td className="font-medium text-gray-900">
                      <span className="inline-flex h-8 w-8 rounded-lg bg-brand-50 text-brand-600 items-center justify-center mr-2.5 align-middle">
                        <Package className="h-4 w-4" />
                      </span>
                      {p.name}
                    </td>
                    <td>{p.qty}</td>
                    <td>{formatCurrency(p.revenue)}</td>
                    <td className="text-green-700">{formatCurrency(p.profit)}</td>
                    <td>{i === 0 && <span className="badge-green">Terlaris</span>}</td>
                  </tr>
                ))}
                {bestSellers.products.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-6">
                      Belum ada data penjualan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {can("pos.sell") && (
        <Link
          href="/pos"
          className="fixed bottom-6 right-6 z-20 h-[52px] w-[52px] rounded-full bg-brand-500 text-white flex items-center justify-center shadow-fab hover:bg-brand-600 transition-colors"
          title="Transaksi Baru"
        >
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </Link>
      )}
    </div>
  );
}

const STAT_STYLE: Record<string, { bg: string; ic: string }> = {
  violet: { bg: "bg-stat-violetBg", ic: "bg-stat-violetIc" },
  sky: { bg: "bg-stat-skyBg", ic: "bg-stat-skyIc" },
  amber: { bg: "bg-stat-amberBg", ic: "bg-stat-amberIc" },
  mint: { bg: "bg-stat-mintBg", ic: "bg-stat-mintIc" },
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
  tone: keyof typeof STAT_STYLE;
}) {
  const s = STAT_STYLE[tone];
  return (
    <div className={`stat-pastel ${s.bg}`}>
      <div className={`stat-pastel-icon ${s.ic}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-xs font-semibold text-gray-600">{label}</div>
      <div className="text-lg font-extrabold text-gray-900 mt-1">{value}</div>
    </div>
  );
}
