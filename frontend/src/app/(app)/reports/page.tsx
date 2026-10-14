"use client";

import useSWR from "swr";
import { api, downloadFile } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

const fetcher = (path: string) => api.get(path);

export default function ReportsPage() {
  const { data: sales } = useSWR("/reports/sales", fetcher);
  const { data: bestSellers } = useSWR("/reports/best-sellers", fetcher);

  return (
    <div className="space-y-6">
      <div className="page-heading mb-0">
        <div>
          <h1 className="page-title">Laporan & Analitik</h1>
          <p className="page-subtitle">Pantau penjualan, laba kotor, dan produk terlaris.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary text-xs" onClick={() => downloadFile("/reports/sales/export.csv", "sales-report.csv")}>
            Export CSV
          </button>
          <button className="btn-secondary text-xs" onClick={() => downloadFile("/reports/sales/export.xlsx", "sales-report.xlsx")}>
            Export Excel
          </button>
          <button className="btn-secondary text-xs" onClick={() => downloadFile("/reports/sales/export.pdf", "sales-report.pdf")}>
            Export PDF
          </button>
        </div>
      </div>

      {sales && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Transaksi" value={sales.transactionCount} />
          <Stat label="Penjualan" value={formatCurrency(sales.totalSales)} />
          <Stat label="HPP" value={formatCurrency(sales.totalCogs)} />
          <Stat label="Laba Kotor" value={formatCurrency(sales.grossProfit)} />
        </div>
      )}

      <div className="card overflow-x-auto min-w-0">
        <h3 className="font-medium text-sm mb-2">Transaksi Penjualan</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Tanggal</th>
              <th>Item</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {sales?.sales?.map((s: any) => (
              <tr key={s.id}>
                <td>{s.invoiceNo}</td>
                <td>{formatDate(s.date)}</td>
                <td>{s.itemCount}</td>
                <td>{formatCurrency(s.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto min-w-0">
        <h3 className="font-medium text-sm mb-2">Produk Terlaris</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Qty</th>
              <th>Pendapatan</th>
              <th>Laba</th>
            </tr>
          </thead>
          <tbody>
            {bestSellers?.products?.map((p: any) => (
              <tr key={p.productId}>
                <td>{p.name}</td>
                <td>{p.qty}</td>
                <td>{formatCurrency(p.revenue)}</td>
                <td>{formatCurrency(p.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
