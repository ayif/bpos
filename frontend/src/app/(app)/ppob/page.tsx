"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import TabBar from "@/components/TabBar";

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
  const { can } = useAuth();
  const [tab, setTab] = useState<"transaksi" | "katalog">("transaksi");
  const { data: products, mutate: mutateProducts } = useSWR("/ppob/products", fetcher);
  // Poll every 3s while any transaction is still PENDING, so a mock-mode or
  // real Digiflazz callback resolution shows up without a manual refresh.
  const { data: transactions, mutate } = useSWR(tab === "transaksi" ? "/ppob/transactions" : null, fetcher, {
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
      <div className="page-heading mb-0">
        <div>
          <h1 className="page-title">PPOB & Pembayaran Digital</h1>
          <p className="page-subtitle">Kelola transaksi produk digital dan katalog provider. Mode mock/live mengikuti konfigurasi Digiflazz.</p>
        </div>
      </div>

      {can("ppob.manage") && (
        <TabBar
          value={tab}
          onChange={setTab}
          options={[
            { value: "transaksi", label: "Transaksi" },
            { value: "katalog", label: "Katalog Produk" },
          ]}
        />
      )}

      {tab === "katalog" && can("ppob.manage") ? (
        <PpobCatalogPanel products={products ?? []} onSaved={() => mutateProducts()} />
      ) : (
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
      )}
    </div>
  );
}

function PpobCatalogPanel({ products, onSaved }: { products: any[]; onSaved: () => void }) {
  const [form, setForm] = useState({ buyerSkuCode: "", productName: "", category: "", brand: "", price: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.buyerSkuCode || !form.productName || !form.category) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/ppob/products", { ...form, brand: form.brand || undefined });
      setForm({ buyerSkuCode: "", productName: "", category: "", brand: "", price: 0 });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan produk PPOB");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card space-y-2">
        <h3 className="font-medium text-sm">Produk PPOB Baru</h3>
        <input className="input" placeholder="Kode SKU" value={form.buyerSkuCode} onChange={(e) => setForm({ ...form, buyerSkuCode: e.target.value })} />
        <input className="input" placeholder="Nama produk" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="input" placeholder="Brand (opsional)" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
        </div>
        <input type="number" min={0} className="input" placeholder="Harga" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={submit} disabled={busy}>
          {busy ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
      <div className="card overflow-x-auto min-w-0">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nama</th>
              <th>Kategori</th>
              <th>Harga</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.buyerSkuCode}</td>
                <td>{p.productName}</td>
                <td>{p.category}</td>
                <td>{formatCurrency(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
