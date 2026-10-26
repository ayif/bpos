"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  ArrowDownToLine,
  Award,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShoppingBag,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { ApiClientError, api, downloadFile } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

const fetcher = (path: string) => api.get(path);

interface SaleRow {
  id: string;
  invoiceNo: string;
  date: string;
  grandTotal: number;
  itemCount: number;
  cogs: number;
  profit: number;
}

interface SalesReport {
  period: { from: string; to: string };
  transactionCount: number;
  totalSales: number;
  totalCogs: number;
  grossProfit: number;
  sales: SaleRow[];
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

type Preset = "today" | "7days" | "30days" | "90days" | "month" | "custom";
type ExportFormat = "csv" | "xlsx" | "pdf";

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultRange(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

function getPresetRange(preset: Exclude<Preset, "custom">) {
  if (preset === "today") return getDefaultRange(1);
  if (preset === "7days") return getDefaultRange(7);
  if (preset === "90days") return getDefaultRange(90);
  if (preset === "30days") return getDefaultRange(30);

  const now = new Date();
  return {
    from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateInputValue(now),
  };
}

function getApiDateRange(from: string, to: string) {
  return {
    from: `${from}T00:00:00.000Z`,
    to: `${to}T23:59:59.999Z`,
  };
}

function formatPeriod(from: string, to: string) {
  if (!from || !to) return "Pilih rentang tanggal";
  const format = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  return `${format(from)} – ${format(to)}`;
}

export default function ReportsPage() {
  const [range, setRange] = useState(() => getDefaultRange(30));
  const [preset, setPreset] = useState<Preset>("30days");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const invalidRange = !range.from || !range.to || range.from > range.to || Boolean(rangeError);
  const apiRange = getApiDateRange(range.from, range.to);
  const query = `from=${encodeURIComponent(apiRange.from)}&to=${encodeURIComponent(apiRange.to)}`;
  const salesPath = `/reports/sales?${query}`;
  const bestSellersPath = `/reports/best-sellers?${query}`;
  const {
    data: sales,
    error: salesError,
    isLoading: salesLoading,
    mutate: refreshSales,
  } = useSWR<SalesReport>(invalidRange ? null : salesPath, fetcher);
  const {
    data: bestSellers,
    error: bestSellersError,
    isLoading: bestSellersLoading,
    mutate: refreshBestSellers,
  } = useSWR<BestSellerReport>(invalidRange ? null : bestSellersPath, fetcher);

  const visibleSales = useMemo(() => {
    const rows = sales?.sales ?? [];
    const term = search.trim().toLocaleLowerCase();
    return rows
      .filter((row) => !term || row.invoiceNo.toLocaleLowerCase().includes(term))
      .slice()
      .reverse();
  }, [sales?.sales, search]);

  const averageTransaction = sales?.transactionCount
    ? sales.totalSales / sales.transactionCount
    : 0;
  const profitMargin = sales?.totalSales
    ? (sales.grossProfit / sales.totalSales) * 100
    : 0;

  function choosePreset(nextPreset: Exclude<Preset, "custom">) {
    setRange(getPresetRange(nextPreset));
    setPreset(nextPreset);
    setRangeError(null);
  }

  function updateRange(field: "from" | "to", value: string) {
    const next = { ...range, [field]: value };
    setRange(next);
    setPreset("custom");
    if (!next.from || !next.to) {
      setRangeError("Pilih tanggal mulai dan tanggal akhir.");
    } else if (next.from > next.to) {
      setRangeError("Tanggal mulai tidak boleh melewati tanggal akhir.");
    } else {
      const rangeLength = (Date.parse(`${next.to}T00:00:00Z`) - Date.parse(`${next.from}T00:00:00Z`)) / 86_400_000 + 1;
      setRangeError(rangeLength > 366 ? "Rentang laporan maksimal 366 hari." : null);
    }
  }

  async function exportReport(format: ExportFormat) {
    setExportError(null);
    setExporting(format);
    try {
      await downloadFile(
        `/reports/sales/export.${format}?${query}`,
        `laporan-penjualan-${range.from}-${range.to}.${format}`
      );
    } catch (error) {
      setExportError(
        error instanceof ApiClientError
          ? error.message
          : "Gagal mengunduh laporan. Silakan coba lagi."
      );
    } finally {
      setExporting(null);
    }
  }

  async function refreshReports() {
    await Promise.all([refreshSales(), refreshBestSellers()]);
  }

  const hasError = salesError || bestSellersError;

  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-brand-800 p-6 text-white shadow-card sm:p-8">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 right-28 h-72 w-72 rounded-full border border-white/10" />
        <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
              <BarChart3 className="h-3.5 w-3.5" />
              Pusat performa bisnis
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Laporan & Analitik
            </h1>
            <p className="mt-2 max-w-xl text-sm text-indigo-100/80">
              Lihat tren penjualan, laba, dan produk terlaris dalam satu tampilan.
              Sesuaikan periode untuk menggali performa tokomu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-60"
              onClick={refreshReports}
              disabled={salesLoading || bestSellersLoading || invalidRange}
            >
              <RefreshCw className={`h-4 w-4 ${salesLoading || bestSellersLoading ? "animate-spin" : ""}`} />
              Perbarui
            </button>
            <div className="relative">
              <details className="group">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-indigo-950 shadow-sm transition hover:bg-indigo-50">
                  <ArrowDownToLine className="h-4 w-4" />
                  Export laporan
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 text-gray-700 shadow-xl">
                  <ExportOption
                    icon={FileSpreadsheet}
                    label="Unduh CSV"
                    loading={exporting === "csv"}
                    disabled={exporting !== null || invalidRange}
                    onClick={() => exportReport("csv")}
                  />
                  <ExportOption
                    icon={FileSpreadsheet}
                    label="Unduh Excel"
                    loading={exporting === "xlsx"}
                    disabled={exporting !== null || invalidRange}
                    onClick={() => exportReport("xlsx")}
                  />
                  <ExportOption
                    icon={FileText}
                    label="Unduh PDF"
                    loading={exporting === "pdf"}
                    disabled={exporting !== null || invalidRange}
                    onClick={() => exportReport("pdf")}
                  />
                </div>
              </details>
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Periode laporan</h2>
              <p className="text-xs text-gray-500">Pilih rentang untuk memfilter semua ringkasan.</p>
            </div>
          </div>
          <div className="text-xs font-medium text-gray-500">{formatPeriod(range.from, range.to)}</div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Periode cepat">
            {([
              ["today", "Hari ini"],
              ["7days", "7 hari"],
              ["30days", "30 hari"],
              ["90days", "90 hari"],
              ["month", "Bulan ini"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => choosePreset(key)}
                aria-pressed={preset === key}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  preset === key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <DateField label="Dari" value={range.from} onChange={(value) => updateRange("from", value)} />
            <DateField label="Sampai" value={range.to} onChange={(value) => updateRange("to", value)} />
          </div>
        </div>
        {rangeError && <p role="alert" className="text-xs font-medium text-red-600">{rangeError}</p>}
        {exportError && <p role="alert" className="text-xs font-medium text-red-600">{exportError}</p>}
      </section>

      {hasError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Gagal memuat sebagian data laporan:{" "}
          {salesError?.message ?? bestSellersError?.message ?? "Silakan perbarui laporan."}
        </div>
      )}

      {salesLoading && !sales ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="card h-28 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : sales ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total penjualan"
              value={formatCurrency(sales.totalSales)}
              detail={`${sales.transactionCount.toLocaleString("id-ID")} transaksi`}
              icon={Wallet}
              tone="indigo"
            />
            <MetricCard
              label="Laba kotor"
              value={formatCurrency(sales.grossProfit)}
              detail={`${profitMargin.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari penjualan`}
              icon={TrendingUp}
              tone="emerald"
            />
            <MetricCard
              label="HPP"
              value={formatCurrency(sales.totalCogs)}
              detail="Biaya pokok barang terjual"
              icon={CircleDollarSign}
              tone="amber"
            />
            <MetricCard
              label="Rata-rata transaksi"
              value={formatCurrency(averageTransaction)}
              detail="Nilai penjualan per transaksi"
              icon={ShoppingBag}
              tone="sky"
            />
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="card min-w-0 xl:col-span-2">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">Tren penjualan & HPP</h2>
                  <p className="mt-1 text-xs text-gray-500">Pergerakan harian · {formatPeriod(range.from, range.to)}</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-indigo-600" /> Penjualan</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-sky-400" /> HPP</span>
                </div>
              </div>
              <SalesTrendChart sales={sales.sales} from={range.from} to={range.to} />
            </div>

            <div className="card min-w-0">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">Produk terlaris</h2>
                  <p className="mt-1 text-xs text-gray-500">Peringkat berdasarkan kuantitas terjual</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Award className="h-4 w-4" />
                </span>
              </div>
              {bestSellersLoading && !bestSellers ? (
                <div className="space-y-4 animate-pulse">
                  {[0, 1, 2, 3].map((item) => <div key={item} className="h-12 rounded-lg bg-gray-50" />)}
                </div>
              ) : (
                <BestSellerList products={bestSellers?.products ?? []} />
              )}
            </div>
          </section>

          <section className="card overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Transaksi penjualan</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Menampilkan {visibleSales.length} dari {(sales.sales ?? []).length} transaksi pada periode ini.
                </p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9 pr-9"
                  type="search"
                  placeholder="Cari nomor invoice..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Cari nomor invoice"
                />
                {search && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    onClick={() => setSearch("")}
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Tanggal</th>
                    <th>Jumlah item</th>
                    <th>Total penjualan</th>
                    <th>Laba kotor</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-semibold text-gray-900">{sale.invoiceNo}</td>
                      <td>{formatDate(sale.date)}</td>
                      <td>{sale.itemCount}</td>
                      <td className="font-medium text-gray-900">{formatCurrency(sale.grandTotal)}</td>
                      <td className="font-medium text-emerald-700">{formatCurrency(sale.profit)}</td>
                    </tr>
                  ))}
                  {visibleSales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                          <Search className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">
                          {search ? "Invoice tidak ditemukan" : "Belum ada transaksi pada periode ini"}
                        </p>
                        {search && <p className="mt-1 text-xs text-gray-400">Coba kata kunci yang berbeda.</p>}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : !hasError && !invalidRange ? (
        <div className="card py-14 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 font-medium text-gray-700">Data laporan belum tersedia</p>
          <p className="mt-1 text-sm text-gray-500">Pilih periode lain atau perbarui data.</p>
        </div>
      ) : null}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type="date"
        className="input min-w-40"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ExportOption({
  icon: Icon,
  label,
  loading,
  disabled,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {loading ? "Menyiapkan..." : label}
    </button>
  );
}

const METRIC_TONES = {
  indigo: { icon: "bg-indigo-100 text-indigo-700", accent: "bg-indigo-500" },
  emerald: { icon: "bg-emerald-100 text-emerald-700", accent: "bg-emerald-500" },
  amber: { icon: "bg-amber-100 text-amber-700", accent: "bg-amber-500" },
  sky: { icon: "bg-sky-100 text-sky-700", accent: "bg-sky-500" },
};

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  tone: keyof typeof METRIC_TONES;
}) {
  const styles = METRIC_TONES[tone];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200/80 bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="mt-2 truncate text-xl font-bold tracking-tight text-gray-900">{value}</p>
          <p className="mt-1 truncate text-xs text-gray-400">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function BestSellerList({ products }: { products: BestSeller[] }) {
  if (products.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">Belum ada data produk terjual.</p>;
  }

  const topProducts = products.slice(0, 5);
  const maxQty = Math.max(...topProducts.map((product) => product.qty), 1);

  return (
    <div className="space-y-4">
      {topProducts.map((product, index) => (
        <div key={product.productId} className="group">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                index === 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
              }`}>
                {index + 1}
              </span>
              <span className="truncate text-sm font-medium text-gray-800" title={product.name}>{product.name}</span>
            </div>
            <span className="shrink-0 text-xs font-semibold text-gray-600">{product.qty.toLocaleString("id-ID")} terjual</span>
          </div>
          <div
            className="ml-8 h-1.5 overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-label={`Penjualan ${product.name}`}
            aria-valuemin={0}
            aria-valuemax={maxQty}
            aria-valuenow={product.qty}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                index === 0 ? "bg-amber-400" : "bg-indigo-400 group-hover:bg-indigo-600"
              }`}
              style={{ width: `${Math.max((product.qty / maxQty) * 100, 2)}%` }}
            />
          </div>
          <div className="ml-8 mt-1 flex justify-between gap-2 text-[11px] text-gray-400">
            <span>Pendapatan {formatCurrency(product.revenue)}</span>
            <span className="text-emerald-700">Laba {formatCurrency(product.profit)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SalesTrendChart({
  sales,
  from,
  to,
}: {
  sales: SaleRow[];
  from: string;
  to: string;
}) {
  const days = useMemo(() => {
    const daily = new Map<string, { sales: number; cogs: number }>();
    for (const sale of sales) {
      const key = new Date(sale.date).toISOString().slice(0, 10);
      const current = daily.get(key) ?? { sales: 0, cogs: 0 };
      current.sales += sale.grandTotal;
      current.cogs += sale.cogs;
      daily.set(key, current);
    }

    const result: Array<{ date: string; sales: number; cogs: number }> = [];
    const cursor = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    while (cursor <= end && result.length <= 366) {
      const date = cursor.toISOString().slice(0, 10);
      result.push({ date, ...(daily.get(date) ?? { sales: 0, cogs: 0 }) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  }, [sales, from, to]);

  if (sales.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-400">
          <BarChart3 className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-medium text-gray-600">Belum ada tren penjualan</p>
        <p className="mt-1 text-xs text-gray-400">Transaksi pada periode ini akan muncul di sini.</p>
      </div>
    );
  }

  const width = 800;
  const height = 260;
  const left = 62;
  const right = 12;
  const top = 12;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...days.flatMap((day) => [day.sales, day.cogs]), 1);
  const point = (value: number, index: number) => {
    const x = days.length <= 1 ? left + plotWidth / 2 : left + (index / (days.length - 1)) * plotWidth;
    const y = top + plotHeight - (value / maxValue) * plotHeight;
    return { x, y };
  };
  const salesPoints = days.map((day, index) => point(day.sales, index));
  const cogsPoints = days.map((day, index) => point(day.cogs, index));
  const formatAxisDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  const labels = Array.from(new Set([0, Math.floor((days.length - 1) / 2), days.length - 1]));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-64 min-w-[560px] w-full overflow-visible"
        role="img"
        aria-label="Grafik tren penjualan dan HPP harian"
      >
        {[0, 1, 2, 3].map((tick) => {
          const y = top + (plotHeight / 3) * tick;
          const value = maxValue * (1 - tick / 3);
          return (
            <g key={tick}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke="#e5e7eb" strokeDasharray="3 5" />
              <text x={left - 9} y={y + 4} textAnchor="end" className="fill-gray-400" fontSize="10">
                {formatShortCurrency(value)}
              </text>
            </g>
          );
        })}
        <polyline
          points={salesPoints.map(({ x, y }) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={cogsPoints.map(({ x, y }) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 4"
        />
        {days.map((day, index) => (
          <g key={day.date}>
            <circle cx={salesPoints[index].x} cy={salesPoints[index].y} r="3.5" fill="#4f46e5" stroke="white" strokeWidth="2">
              <title>{formatAxisDate(day.date)} · Penjualan: {formatCurrency(day.sales)}</title>
            </circle>
            <circle cx={cogsPoints[index].x} cy={cogsPoints[index].y} r="3" fill="#38bdf8" stroke="white" strokeWidth="2">
              <title>{formatAxisDate(day.date)} · HPP: {formatCurrency(day.cogs)}</title>
            </circle>
          </g>
        ))}
        {labels.map((index) => {
          const x = days.length <= 1 ? left + plotWidth / 2 : left + (index / (days.length - 1)) * plotWidth;
          return (
            <text key={days[index].date} x={x} y={height - 8} textAnchor="middle" className="fill-gray-400" fontSize="10">
              {formatAxisDate(days[index].date)}
            </text>
          );
        })}
      </svg>
      <p className="sr-only">Arahkan ke titik grafik untuk melihat nilai harian.</p>
    </div>
  );
}

function formatShortCurrency(value: number) {
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (value >= 1_000) return `Rp${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}
