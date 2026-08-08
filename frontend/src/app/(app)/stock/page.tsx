"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import TabBar from "@/components/TabBar";

const fetcher = (path: string) => api.get(path);

export default function StockPage() {
  const [tab, setTab] = useState<"transfer" | "opname" | "movements">("movements");
  const { data: branches } = useSWR("/branches", fetcher);
  const { data: products } = useSWR("/products?pageSize=100", fetcher);
  const { data: transfers, mutate: mutateTransfers } = useSWR(tab === "transfer" ? "/stock/transfers" : null, fetcher);
  const { data: opnames, mutate: mutateOpnames } = useSWR(tab === "opname" ? "/stock/opnames" : null, fetcher);
  const { data: movements } = useSWR(tab === "movements" ? "/stock/movements" : null, fetcher);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Transfer & Stock Opname</h1>
        <p className="text-sm text-gray-500">Kelola perpindahan stok antar cabang dan penyesuaian fisik.</p>
      </div>
      <TabBar
        value={tab}
        onChange={setTab}
        options={[
          { value: "movements", label: "Riwayat Stok" },
          { value: "transfer", label: "Transfer Antar Cabang" },
          { value: "opname", label: "Stock Opname" },
        ]}
      />

      {tab === "movements" && (
        <div className="card overflow-x-auto min-w-0">
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Produk</th>
                <th>Tipe</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {movements?.map((m: any) => (
                <tr key={m.id}>
                  <td>{formatDate(m.createdAt)}</td>
                  <td>{m.product?.name}</td>
                  <td>{m.type}</td>
                  <td className={m.qty < 0 ? "text-red-600" : "text-green-600"}>{m.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "transfer" && (
        <TransferForm branches={branches ?? []} products={products?.items ?? []} transfers={transfers ?? []} onSaved={() => mutateTransfers()} />
      )}

      {tab === "opname" && <OpnameForm products={products?.items ?? []} opnames={opnames ?? []} onSaved={() => mutateOpnames()} />}
    </div>
  );
}

function TransferForm({ branches, products, transfers, onSaved }: any) {
  const [toBranchId, setToBranchId] = useState("");
  const [items, setItems] = useState<{ productId: string; qty: number }[]>([{ productId: "", qty: 1 }]);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await api.post("/stock/transfers", { toBranchId, items: items.filter((i) => i.productId) });
      setItems([{ productId: "", qty: 1 }]);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal transfer stok");
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card space-y-2">
        <h3 className="font-medium text-sm">Transfer Stok Baru</h3>
        <select className="input" value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
          <option value="">Cabang tujuan</option>
          {branches.map((b: any) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <select
              className="input"
              value={item.productId}
              onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, productId: e.target.value } : it)))}
            >
              <option value="">Produk</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              className="input w-20"
              value={item.qty}
              onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: Number(e.target.value) } : it)))}
            />
          </div>
        ))}
        <button className="btn-secondary text-xs" onClick={() => setItems((prev) => [...prev, { productId: "", qty: 1 }])}>
          + Baris
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={submit}>
          Kirim Transfer
        </button>
      </div>

      <div className="card overflow-x-auto min-w-0">
        <h3 className="font-medium text-sm mb-2">Riwayat Transfer</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Dari</th>
              <th>Ke</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t: any) => (
              <tr key={t.id}>
                <td>{t.code}</td>
                <td>{t.fromBranch?.name}</td>
                <td>{t.toBranch?.name}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpnameForm({ products, opnames, onSaved }: any) {
  const [items, setItems] = useState<{ productId: string; countedQty: number }[]>([{ productId: "", countedQty: 0 }]);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await api.post("/stock/opnames", { items: items.filter((i) => i.productId) });
      setItems([{ productId: "", countedQty: 0 }]);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan opname");
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card space-y-2">
        <h3 className="font-medium text-sm">Stock Opname Baru</h3>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <select
              className="input"
              value={item.productId}
              onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, productId: e.target.value } : it)))}
            >
              <option value="">Produk</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              className="input w-24"
              placeholder="Qty fisik"
              value={item.countedQty}
              onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, countedQty: Number(e.target.value) } : it)))}
            />
          </div>
        ))}
        <button className="btn-secondary text-xs" onClick={() => setItems((prev) => [...prev, { productId: "", countedQty: 0 }])}>
          + Baris
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={submit}>
          Simpan Opname
        </button>
      </div>

      <div className="card overflow-x-auto min-w-0">
        <h3 className="font-medium text-sm mb-2">Riwayat Opname</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Status</th>
              <th>Item</th>
            </tr>
          </thead>
          <tbody>
            {opnames.map((o: any) => (
              <tr key={o.id}>
                <td>{o.code}</td>
                <td>{o.status}</td>
                <td>{o.items?.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
