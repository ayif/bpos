"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";

const fetcher = (path: string) => api.get(path);

export default function SettingsPage() {
  const { data: setting, mutate } = useSWR("/settings", fetcher);
  const [form, setForm] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (setting) setForm(setting);
  }, [setting]);

  async function save() {
    const { id, branchId, createdAt, updatedAt, ...body } = form;
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      await api.put("/settings", {
        ...body,
        taxRate: Number(body.taxRate),
        loyaltyEarnRate: Number(body.loyaltyEarnRate),
        loyaltyRedeemRate: Number(body.loyaltyRedeemRate),
      });
      setMessage("Pengaturan disimpan.");
      mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan pengaturan");
    } finally {
      setBusy(false);
    }
  }

  if (!form) return <div className="text-sm text-gray-500">Memuat...</div>;

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-semibold">Pengaturan</h1>
      <div className="card space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nama Toko</label>
          <input className="input" value={form.storeName ?? ""} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Alamat</label>
          <input className="input" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Telepon</label>
          <input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pajak (%)</label>
            <input type="number" className="input" value={form.taxRate ?? 0} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ukuran Struk</label>
            <select className="input" value={form.receiptSize ?? "58mm"} onChange={(e) => setForm({ ...form, receiptSize: e.target.value })}>
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
              <option value="A4">A4</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nama Printer</label>
          <input className="input" value={form.printerName ?? ""} onChange={(e) => setForm({ ...form, printerName: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tema</label>
          <select className="input" value={form.theme ?? "light"} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
            <option value="light">Terang</option>
            <option value="dark">Gelap</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Rate Poin (per Rp1.000)</label>
            <input type="number" className="input" value={form.loyaltyEarnRate ?? 1} onChange={(e) => setForm({ ...form, loyaltyEarnRate: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nilai Tukar Poin</label>
            <input type="number" className="input" value={form.loyaltyRedeemRate ?? 1} onChange={(e) => setForm({ ...form, loyaltyRedeemRate: e.target.value })} />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {message && <p className="text-xs text-brand-700">{message}</p>}
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>
    </div>
  );
}
