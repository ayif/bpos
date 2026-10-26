"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Clock3,
  FileBarChart,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import SalesTrendChart from "@/components/SalesTrendChart";
import PaymentDonut from "@/components/PaymentDonut";

const fetcher = (path: string) => api.get(path);

interface SaleEntry {
  id: string;
  invoiceNo: string;
  date: string;
  grandTotal: number;
  cogs: number;
}

interface SalesReport {
  transactionCount: number;
  totalSales: number;
  totalCogs: number;
  grossProfit: number;
  paymentBreakdown: Record<string, number>;
  sales: SaleEntry[];
}

interface BestSeller {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
  profit: number;
}

interface BestSellerReport {
  products: BestSeller[];
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const canViewReports = can("report.view");
  const {
    data: salesReport,
    error: salesError,
    isLoading: salesLoading,
    mutate: refreshSales,
  } = useSWR<SalesReport>(canViewReports ? "/reports/sales" : null, fetcher);
  const {
    data: bestSellers,
    error: bestSellersError,
    isLoading: bestSellersLoading,
    mutate: refreshBestSellers,
  } = useSWR<BestSellerReport>(canViewReports ? "/reports/best-sellers" : null, fetcher);
  const loading = salesLoading || bestSellersLoading;
  const latestSales = salesReport?.sales.slice(-5).reverse() ?? [];
  const topProducts = bestSellers?.products.slice(0, 5) ?? [];

  async function refreshDashboard() {
    await Promise.all([refreshSales(), refreshBestSellers()]);
  }

  const quickActions: Array<{
    href: string;
    label: string;
    description: string;
    icon: LucideIcon;
    tone: string;
  }> = [];
  if (can("product.view")) {
    quickActions.push({
      href: "/products",
      label: "Kelola produk",
      description: "Lihat produk dan persediaan",
      icon: Boxes,
      tone: "text-sky-700 bg-sky-50 group-hover:bg-sky-100",
    });
  }
  if (can("purchasing.view")) {
    quickActions.push({
      href: "/purchasing",
      label: "Pembelian",
      description: "PO dan saran restock",
      icon: Package,
      tone: "text-amber-700 bg-amber-50 group-hover:bg-amber-100",
    });
  }
  if (can("report.view")) {
    quickActions.push({
      href: "/reports",
      label: "Lihat laporan",
      description: "Analisis penjualan toko",
      icon: FileBarChart,
      tone: "text-emerald-700 bg-emerald-50 group-hover:bg-emerald-100",
    });
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-brand-800 p-6 text-white shadow-card sm:p-8">
        <div className="absolute -right-10 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-36 right-40 h-80 w-80 rounded-full border border-white/10" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              Ringkasan operasional · 30 hari terakhir
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Halo, {user?.name ?? "Pengguna"}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-indigo-100/80">
              Berikut gambaran performa tokomu. Pantau penjualan, transaksi terbaru,
              dan produk yang paling diminati.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewReports && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-60"
                onClick={refreshDashboard}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Perbarui
              </button>
            )}
            {can("pos.sell") && (
              <Link href="/pos" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-950 shadow-sm transition hover:bg-indigo-50">
                <Plus className="h-4 w-4" />
                Transaksi baru
              </Link>
            )}
          </div>
        </div>
      </section>

      {quickActions.length > 0 && (
        <section className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${quickActions.length > 2 ? "xl:grid-cols-4" : "xl:grid-cols-2"}`}>
          {quickActions.map(({ href, label, description, icon: Icon, tone }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-gray-200/80 bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">{label}</span>
                <span className="mt-0.5 block truncate text-xs text-gray-500">{description}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-indigo-600" />
            </Link>
          ))}
        </section>
      )}

      {!canViewReports ? (
        <section className="card flex flex-col items-center py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <BarChart3 className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-semibold text-gray-900">Ringkasan analitik tidak tersedia</h2>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Akun ini belum memiliki izin untuk melihat laporan penjualan.
          </p>
        </section>
      ) : salesLoading && !salesReport ? (
        <DashboardSkeleton />
      ) : salesError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Gagal memuat ringkasan penjualan:{" "}
          {salesError instanceof ApiClientError ? salesError.message : "Silakan perbarui dashboard."}
        </div>
      ) : salesReport ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total penjualan"
              value={formatCurrency(salesReport.totalSales)}
              detail={`${salesReport.transactionCount.toLocaleString("id-ID")} transaksi selesai`}
              icon={Wallet}
              tone="indigo"
            />
            <StatCard
              label="Laba kotor"
              value={formatCurrency(salesReport.grossProfit)}
              detail="Penjualan dikurangi HPP"
              icon={TrendingUp}
              tone="emerald"
            />
            <StatCard
              label="HPP"
              value={formatCurrency(salesReport.totalCogs)}
              detail="Harga pokok barang terjual"
              icon={TrendingDown}
              tone="amber"
            />
            <StatCard
              label="Rata-rata transaksi"
              value={formatCurrency(salesReport.transactionCount ? salesReport.totalSales / salesReport.transactionCount : 0)}
              detail="Nilai penjualan per transaksi"
              icon={ShoppingBag}
              tone="sky"
            />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="card min-w-0 xl:col-span-2">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">Tren penjualan & HPP</h2>
                  <p className="mt-1 text-xs text-gray-500">Performa harian selama 30 hari terakhir</p>
                </div>
                <Link href="/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800">
                  Analisis lengkap <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <SalesTrendChart sales={salesReport.sales} />
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-gray-100 pt-4 text-sm">
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

            <div className="space-y-4">
              <div className="card min-w-0">
                <div className="mb-4">
                  <h2 className="font-semibold text-gray-900">Metode pembayaran</h2>
                  <p className="mt-1 text-xs text-gray-500">Distribusi nilai transaksi</p>
                </div>
                <PaymentDonut breakdown={salesReport.paymentBreakdown ?? {}} />
              </div>

              <div className="card min-w-0">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">Transaksi terbaru</h2>
                    <p className="mt-1 text-xs text-gray-500">Aktivitas penjualan terakhir</p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Clock3 className="h-4 w-4" />
                  </span>
                </div>
                {latestSales.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {latestSales.map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                            <ShoppingBag className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-800">{sale.invoiceNo}</div>
                            <div className="text-[11px] text-gray-400">{formatDate(sale.date)}</div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-sm font-semibold text-gray-900">
                          {formatCurrency(sale.grandTotal)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyMessage message="Belum ada transaksi pada periode ini." />
                )}
                {can("pos.sell") && (
                  <Link href="/pos" className="mt-4 flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                    Buka kasir <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Produk terlaris</h2>
                <p className="mt-1 text-xs text-gray-500">Produk paling diminati selama 30 hari terakhir</p>
              </div>
              <Link href="/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800">
                Semua laporan <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {bestSellersError ? (
              <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Gagal memuat produk terlaris.
              </div>
            ) : bestSellersLoading && !bestSellers ? (
              <div className="space-y-3 animate-pulse">
                {[0, 1, 2].map((item) => <div key={item} className="h-12 rounded-lg bg-gray-50" />)}
              </div>
            ) : topProducts.length > 0 ? (
              <TopProducts products={topProducts} />
            ) : (
              <EmptyMessage message="Belum ada data produk terjual pada periode ini." />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

const STAT_STYLE = {
  indigo: { icon: "bg-indigo-100 text-indigo-700", accent: "bg-indigo-500" },
  emerald: { icon: "bg-emerald-100 text-emerald-700", accent: "bg-emerald-500" },
  amber: { icon: "bg-amber-100 text-amber-700", accent: "bg-amber-500" },
  sky: { icon: "bg-sky-100 text-sky-700", accent: "bg-sky-500" },
};

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone: keyof typeof STAT_STYLE;
}) {
  const style = STAT_STYLE[tone];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200/80 bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`absolute inset-x-0 top-0 h-1 ${style.accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="mt-2 truncate text-xl font-bold tracking-tight text-gray-900">{value}</p>
          <p className="mt-1 truncate text-xs text-gray-400">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function TopProducts({ products }: { products: BestSeller[] }) {
  const maxQty = Math.max(...products.map((product) => product.qty), 1);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {products.map((product, index) => (
        <div key={product.productId} className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 p-3 transition hover:border-indigo-100 hover:bg-indigo-50/30">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
            index === 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
          }`}>
            {index === 0 ? <Package className="h-4 w-4" /> : index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-gray-800" title={product.name}>{product.name}</span>
              <span className="shrink-0 text-xs font-semibold text-gray-500">{product.qty.toLocaleString("id-ID")} terjual</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-gray-100"
              role="progressbar"
              aria-label={`Penjualan ${product.name}`}
              aria-valuemin={0}
              aria-valuemax={maxQty}
              aria-valuenow={product.qty}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${index === 0 ? "bg-amber-400" : "bg-indigo-400"}`}
                style={{ width: `${Math.max((product.qty / maxQty) * 100, 2)}%` }}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] text-gray-400">
              <span>Pendapatan {formatCurrency(product.revenue)}</span>
              <span className="font-medium text-emerald-700">Laba {formatCurrency(product.profit)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <ArrowDownToLine className="h-4 w-4 rotate-180" />
      </span>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="card h-28 animate-pulse bg-gray-50" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card h-72 animate-pulse bg-gray-50 xl:col-span-2" />
        <div className="card h-72 animate-pulse bg-gray-50" />
      </div>
    </div>
  );
}
