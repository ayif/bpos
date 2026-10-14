"use client";

import useSWR from "swr";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { Receipt, Wallet, TrendingDown, TrendingUp, Package, Plus, ArrowUpRight, type LucideIcon } from "lucide-react";
import SalesTrendChart from "@/components/SalesTrendChart";
import PaymentDonut from "@/components/PaymentDonut";

const fetcher = (path: string) => api.get(path);

export default function DashboardPage() {
  const { user, can } = useAuth();
  const { data: salesReport } = useSWR(can("report.view") ? "/reports/sales" : null, fetcher);
  const { data: bestSellers } = useSWR(can("report.view") ? "/reports/best-sellers" : null, fetcher);

  return (
    <div className="space-y-5">
      <div className="page-heading">
        <div>
          <div className="text-xs text-gray-400 mb-1">Ringkasan operasional</div>
          <h1 className="page-title">Selamat datang, {user?.name}</h1>
          <p className="page-subtitle">Pantau performa toko dan transaksi terbaru.</p>
        </div>
        {can("pos.sell") && (
          <Link href="/pos" className="btn-primary">
            <Plus className="h-4 w-4" /> Transaksi Baru
          </Link>
        )}
      </div>

      {salesReport && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Transaksi" value={salesReport.transactionCount} icon={Receipt} tone="violet" />
          <StatCard label="Total Penjualan" value={formatCurrency(salesReport.totalSales)} icon={Wallet} tone="sky" />
          <StatCard label="HPP (COGS)" value={formatCurrency(salesReport.totalCogs)} icon={TrendingDown} tone="amber" />
          <StatCard label="Laba Kotor" value={formatCurrency(salesReport.grossProfit)} icon={TrendingUp} tone="mint" />
        </div>
      )}

      {salesReport && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card lg:col-span-2 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Penjualan vs HPP Harian</h2>
                <p className="text-xs text-gray-400 mt-1">Performa 30 hari terakhir</p>
              </div>
              <Link href="/reports" className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
                Lihat laporan <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
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
              <h2 className="font-semibold text-gray-900 mb-1">Metode Pembayaran</h2>
              <p className="text-xs text-gray-400 mb-4">Distribusi nilai transaksi</p>
              <PaymentDonut breakdown={salesReport.paymentBreakdown ?? {}} />
            </div>

            <div className="card min-w-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Transaksi Terbaru</h2>
                <Link href="/pos" className="text-xs font-semibold text-brand-600 hover:text-brand-700">Lihat semua</Link>
              </div>
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
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">Produk Terlaris</h2>
              <p className="text-xs text-gray-400 mt-1">Produk dengan jumlah penjualan tertinggi</p>
            </div>
            <Link href="/reports" className="text-xs font-semibold text-brand-600 hover:text-brand-700">Semua laporan</Link>
          </div>
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

    </div>
  );
}

const STAT_STYLE: Record<string, { ic: string }> = {
  violet: { ic: "bg-brand-500" },
  sky: { ic: "bg-sky-500" },
  amber: { ic: "bg-amber-500" },
  mint: { ic: "bg-emerald-500" },
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
    <div className="rounded-xl bg-white border border-gray-200/80 shadow-card p-4 flex items-center gap-3 min-w-0">
      <div className={`h-11 w-11 rounded-xl ${s.ic} flex items-center justify-center text-white shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-500 truncate">{label}</div>
        <div className="text-xl font-bold tracking-tight text-gray-900 mt-1 truncate">{value}</div>
      </div>
    </div>
  );
}
