"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Modal from "@/components/Modal";

const fetcher = (path: string) => api.get(path);

export default function CustomersPage() {
  const { can } = useAuth();
  const { data: customers, mutate } = useSWR("/customers", fetcher);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function submit() {
    if (!form.name) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/customers", form);
      setForm({ name: "", phone: "", email: "" });
      mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan pelanggan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pelanggan & Loyalty</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card space-y-2">
          <h3 className="font-medium text-sm">Pelanggan Baru</h3>
          <input className="input" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="No. HP" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
        <div className="card md:col-span-2 overflow-x-auto min-w-0">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>HP</th>
                <th>Poin</th>
                <th>Price Level</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers?.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.points}</td>
                  <td>{c.priceLevel?.name ?? "Retail"}</td>
                  <td>
                    <button className="text-xs text-brand-600" onClick={() => setSelectedId(c.id)}>
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && (
        <CustomerDetailModal
          customerId={selectedId}
          canManage={can("customer.manage")}
          onClose={() => setSelectedId(null)}
          onChanged={() => mutate()}
        />
      )}
    </div>
  );
}

function CustomerDetailModal({
  customerId,
  canManage,
  onClose,
  onChanged,
}: {
  customerId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: customer, mutate } = useSWR(`/customers/${customerId}`, fetcher);
  const [editForm, setEditForm] = useState<any>(null);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [redeemNote, setRedeemNote] = useState("");
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = editForm ?? (customer ? { name: customer.name ?? "", phone: customer.phone ?? "", email: customer.email ?? "", address: customer.address ?? "" } : null);

  async function saveEdit() {
    if (!form) return;
    setError(null);
    setBusy(true);
    try {
      await api.put(`/customers/${customerId}`, form);
      await mutate();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan pelanggan");
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    if (redeemPoints <= 0) return;
    setError(null);
    setBusy(true);
    try {
      await api.post(`/customers/${customerId}/loyalty/redeem`, { points: redeemPoints, note: redeemNote || undefined });
      setRedeemPoints(0);
      setRedeemNote("");
      await mutate();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menukar poin");
    } finally {
      setBusy(false);
    }
  }

  async function adjust() {
    if (adjustPoints === 0) return;
    setError(null);
    setBusy(true);
    try {
      await api.post(`/customers/${customerId}/loyalty/adjust`, { points: adjustPoints, note: adjustNote || undefined });
      setAdjustPoints(0);
      setAdjustNote("");
      await mutate();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyesuaikan poin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={customer ? `Detail Pelanggan — ${customer.name}` : "Detail Pelanggan"} onClose={onClose} widthClass="max-w-lg">
      {!customer || !form ? (
        <p className="text-sm text-gray-500">Memuat...</p>
      ) : (
        <div className="space-y-4">
          {canManage && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-gray-400">Edit Data</h3>
              <input className="input" placeholder="Nama" value={form.name} onChange={(e) => setEditForm({ ...form, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="No. HP" value={form.phone} onChange={(e) => setEditForm({ ...form, phone: e.target.value })} />
                <input className="input" placeholder="Email" value={form.email} onChange={(e) => setEditForm({ ...form, email: e.target.value })} />
              </div>
              <input className="input" placeholder="Alamat" value={form.address} onChange={(e) => setEditForm({ ...form, address: e.target.value })} />
              <button className="btn-secondary text-xs" onClick={saveEdit} disabled={busy}>
                Simpan Data
              </button>
            </div>
          )}

          <div className="border-t pt-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Poin saat ini</span>
              <span className="font-semibold text-gray-900">{customer.points}</span>
            </div>
            {canManage && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Tukar Poin</p>
                  <input type="number" min={0} className="input" value={redeemPoints} onChange={(e) => setRedeemPoints(Number(e.target.value))} />
                  <input className="input" placeholder="Catatan" value={redeemNote} onChange={(e) => setRedeemNote(e.target.value)} />
                  <button className="btn-secondary text-xs w-full" onClick={redeem} disabled={busy}>
                    Tukar
                  </button>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Sesuaikan Poin (+/-)</p>
                  <input type="number" className="input" value={adjustPoints} onChange={(e) => setAdjustPoints(Number(e.target.value))} />
                  <input className="input" placeholder="Catatan" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
                  <button className="btn-secondary text-xs w-full" onClick={adjust} disabled={busy}>
                    Sesuaikan
                  </button>
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>

          <div className="border-t pt-3">
            <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Riwayat Poin</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto text-sm">
              {customer.loyaltyTransactions?.map((t: any) => (
                <div key={t.id} className="flex justify-between">
                  <span className="text-gray-600">
                    {t.type}
                    {t.note ? ` — ${t.note}` : ""}
                  </span>
                  <span className={t.points < 0 ? "text-red-600" : "text-green-600"}>
                    {t.points > 0 ? "+" : ""}
                    {t.points}
                  </span>
                </div>
              ))}
              {(!customer.loyaltyTransactions || customer.loyaltyTransactions.length === 0) && (
                <p className="text-gray-400">Belum ada riwayat</p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
