"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

const fetcher = (path: string) => api.get(path);

const PPOB_STATUS_STYLE: Record<string, string> = {
  PENDING: "badge-amber",
  SUCCESS: "badge-green",
  FAILED: "badge-red",
};

function PpobStatusBadge({ status }: { status: string }) {
  return <span className={PPOB_STATUS_STYLE[status] ?? "badge-gray"}>{status}</span>;
}

export default function PpobPage() {
  const { data: products } = useSWR("/ppob/products", fetcher);
  // Poll every 3s while any transaction is still PENDING, so a mock-mode or
  // real Digiflazz callback resolution shows up without a manual refresh.
  const { data: transactions, mutate } = useSWR("/ppob/transactions", fetcher, {
    refreshInterval: (data) => (data?.some((t: any) => t.status === "PENDING") ? 3000 : 0),
  });
  const [ppobProductId, setPpobProductId] = useState("");
  const [customerNo, setCustomerNo] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setMessage(null);
    try {
      const tx = await api.post("/ppob/transactions", { ppobProductId, customerNo });
      setMessage(
        tx.status === "PENDING"
          ? `Diproses: ${tx.refId} — status akan diperbarui otomatis`
          : `${tx.status === "SUCCESS" ? "Sukses" : "Gagal"}: ${tx.refId} (SN: ${tx.sn ?? "-"})`
      );
      setCustomerNo("");
      mutate();
    } catch (err) {
      setMessage(err instanceof ApiClientError ? err.message : "Transaksi gagal");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">PPOB & Pembayaran Digital</h1>
        <p className="text-xs text-gray-500">Terintegrasi dengan Digiflazz (mode mock jika kredensial belum diatur).</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card space-y-2">
          <h3 className="font-medium text-sm">Transaksi Baru</h3>
          <select className="input" value={ppobProductId} onChange={(e) => setPpobProductId(e.target.value)}>
            <option value="">Pilih produk</option>
            {products?.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.productName} - {formatCurrency(p.price)}
              </option>
            ))}
          </select>
          <input className="input" placeholder="No. Pelanggan / No. HP / ID Pelanggan" value={customerNo} onChange={(e) => setCustomerNo(e.target.value)} />
          {message && <p className="text-xs text-brand-700">{message}</p>}
          <button className="btn-primary w-full" onClick={submit}>
            Proses Transaksi
          </button>
        </div>

        <div className="card overflow-x-auto min-w-0">
          <h3 className="font-medium text-sm mb-2">Riwayat Transaksi</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Produk</th>
                <th>Status</th>
                <th>SN / Keterangan</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {transactions?.map((t: any) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap font-mono text-xs">{t.refId}</td>
                  <td className="whitespace-nowrap">{t.ppobProduct?.productName}</td>
                  <td className="whitespace-nowrap"><PpobStatusBadge status={t.status} /></td>
                  <td className="text-xs max-w-[220px]">
                    {t.sn && <div className="font-mono truncate" title={t.sn}>{t.sn}</div>}
                    {t.message && (
                      <div className="text-gray-500 truncate" title={t.message}>
                        {t.message}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{formatDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
