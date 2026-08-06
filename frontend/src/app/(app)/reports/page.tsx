"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

const fetcher = (path: string) => api.get(path);
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export default function ReportsPage() {
  const { data: sales } = useSWR("/reports/sales", fetcher);
  const { data: bestSellers } = useSWR("/reports/best-sellers", fetcher);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Laporan & Analitik</h1>
        <div className="flex gap-2">
          <a className="btn-secondary text-xs" href={`${API_URL}/reports/sales/export.csv`} target="_blank" rel="noreferrer">
            Export CSV
          </a>
          <a className="btn-secondary text-xs" href={`${API_URL}/reports/sales/export.xlsx`} target="_blank" rel="noreferrer">
            Export Excel
          </a>
          <a className="btn-secondary text-xs" href={`${API_URL}/reports/sales/export.pdf`} target="_blank" rel="noreferrer">
            Export PDF
          </a>
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
