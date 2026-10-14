"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

const fetcher = (path: string) => api.get(path);

export default function ExpensesPage() {
  const { data: categories, mutate: mutateCategories } = useSWR("/expenses/categories", fetcher);
  const { data: expenses, mutate } = useSWR("/expenses", fetcher);
  const [form, setForm] = useState({ categoryId: "", amount: 0, description: "" });
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.categoryId || !form.amount) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/expenses", form);
      setForm({ categoryId: "", amount: 0, description: "" });
      mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan pengeluaran");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    if (!newCategory) return;
    await api.post("/expenses/categories", { name: newCategory });
    setNewCategory("");
    mutateCategories();
  }

  return (
    <div className="space-y-4">
      <div className="page-heading mb-0">
        <div>
          <h1 className="page-title">Pengeluaran</h1>
          <p className="page-subtitle">Catat biaya operasional dan kelompokkan berdasarkan kategori.</p>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card space-y-2">
          <h3 className="font-medium text-sm">Pengeluaran Baru</h3>
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Kategori</option>
            {categories?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input type="number" className="input" placeholder="Jumlah (Rp)" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          <input className="input" placeholder="Keterangan" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
          </button>

          <div className="pt-2 border-t">
            <div className="flex gap-2">
              <input className="input" placeholder="Kategori baru" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              <button className="btn-secondary text-xs" onClick={addCategory}>
                Tambah
              </button>
            </div>
          </div>
        </div>
        <div className="card md:col-span-2 overflow-x-auto min-w-0">
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Kategori</th>
                <th>Keterangan</th>
                <th>Jumlah</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {expenses?.map((e: any) => (
                <tr key={e.id}>
                  <td>{e.code}</td>
                  <td>{e.category?.name}</td>
                  <td>{e.description || "-"}</td>
                  <td>{formatCurrency(e.amount)}</td>
                  <td>{formatDate(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
