"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import Modal from "@/components/Modal";

const fetcher = (path: string) => api.get(path);
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export default function ProductsPage() {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const { data, mutate } = useSWR(`/products?q=${encodeURIComponent(q)}&pageSize=50`, fetcher);
  const { data: categories } = useSWR("/products/categories", fetcher);
  const { data: units } = useSWR("/products/units", fetcher);

  async function handleDelete(product: any) {
    if (!window.confirm(`Hapus produk "${product.name}"?`)) return;
    await api.delete(`/products/${product.id}`);
    mutate();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const token = localStorage.getItem("bpos_token");
    const branchId = localStorage.getItem("bpos_branch_id");
    await fetch(`${API_URL}/products/import/excel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...(branchId ? { "X-Branch-Id": branchId } : {}) },
      body: form,
    });
    mutate();
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Produk & Stok</h1>
        <div className="flex gap-2 flex-wrap">
          <a href={`${API_URL}/products/export/excel`} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
            Export Excel
          </a>
          <label className="btn-secondary text-xs cursor-pointer">
            Import Excel
            <input type="file" accept=".xlsx" className="hidden" onChange={handleImport} />
          </label>
          <button className="btn-primary text-xs" onClick={() => setShowForm(true)}>
            + Produk Baru
          </button>
        </div>
      </div>

      <input className="input max-w-sm" placeholder="Cari produk..." value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card overflow-x-auto min-w-0">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nama</th>
              <th>Kategori</th>
              <th>Harga Jual</th>
              <th>Stok</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((p: any) => (
              <tr key={p.id}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.category?.name ?? "-"}</td>
                <td>{formatCurrency(p.sellPrice)}</td>
                <td>{p.stocks?.[0]?.qty ?? 0}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <a href={`${API_URL}/products/labels/pdf?ids=${p.id}`} target="_blank" rel="noreferrer" className="text-xs text-brand-600">
                      Cetak Label
                    </a>
                    {can("product.manage") && (
                      <>
                        <button className="text-xs text-brand-600" onClick={() => setEditingProduct(p)}>
                          Edit
                        </button>
                        <button className="text-xs text-red-600" onClick={() => handleDelete(p)}>
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProductFormModal
          categories={categories ?? []}
          units={units ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            mutate();
          }}
        />
      )}

      {editingProduct && (
        <ProductFormModal
          product={editingProduct}
          categories={categories ?? []}
          units={units ?? []}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            setEditingProduct(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function ProductFormModal({ product, categories, units, onClose, onSaved }: any) {
  const isEdit = Boolean(product);
  const [form, setForm] = useState<{
    sku: string;
    barcode: string;
    name: string;
    categoryId: string;
    unitId: string;
    sellPrice: number;
    taxRate: number;
    initialCost: number;
    initialQty: number;
  }>(
    isEdit
      ? {
          sku: product.sku ?? "",
          barcode: product.barcode ?? "",
          name: product.name ?? "",
          categoryId: product.categoryId ?? "",
          unitId: product.unitId ?? "",
          sellPrice: Number(product.sellPrice ?? 0),
          taxRate: Number(product.taxRate ?? 11),
          initialCost: 0,
          initialQty: 0,
        }
      : {
          sku: "",
          barcode: "",
          name: "",
          categoryId: "",
          unitId: "",
          sellPrice: 0,
          initialCost: 0,
          initialQty: 0,
          taxRate: 11,
        }
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { initialCost, initialQty, ...editable } = form;
      const body = {
        ...editable,
        categoryId: form.categoryId || undefined,
        unitId: form.unitId || undefined,
        barcode: form.barcode || undefined,
      };
      if (isEdit) {
        await api.put(`/products/${product.id}`, body);
      } else {
        await api.post("/products", { ...body, initialCost, initialQty });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan produk");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Produk" : "Produk Baru"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input required className="input" placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        <input className="input" placeholder="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
        <input required className="input" placeholder="Nama produk" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Kategori</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
            <option value="">Satuan</option>
            {units.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        {isEdit ? (
          <input type="number" className="input" placeholder="Harga Jual" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: Number(e.target.value) })} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <input type="number" className="input" placeholder="Harga Modal" value={form.initialCost} onChange={(e) => setForm({ ...form, initialCost: Number(e.target.value) })} />
            <input type="number" className="input" placeholder="Harga Jual" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: Number(e.target.value) })} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {!isEdit && (
            <input type="number" className="input" placeholder="Stok Awal" value={form.initialQty} onChange={(e) => setForm({ ...form, initialQty: Number(e.target.value) })} />
          )}
          <input type="number" className={`input ${isEdit ? "col-span-2" : ""}`} placeholder="Pajak %" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
