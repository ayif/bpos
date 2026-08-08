"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Modal from "@/components/Modal";

const fetcher = (path: string) => api.get(path);

export default function BranchesPage() {
  const { can } = useAuth();
  const { data: branches, mutate } = useSWR("/branches", fetcher);
  const [form, setForm] = useState({ code: "", name: "", address: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);

  async function submit() {
    if (!form.code || !form.name) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/branches", form);
      setForm({ code: "", name: "", address: "", phone: "" });
      mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan cabang");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Manajemen Cabang</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card space-y-2">
          <h3 className="font-medium text-sm">Cabang Baru</h3>
          <input className="input" placeholder="Kode cabang" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="input" placeholder="Nama cabang" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Alamat" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="input" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
        <div className="card md:col-span-2 overflow-x-auto min-w-0">
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                <th>Alamat</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {branches?.map((b: any) => (
                <tr key={b.id}>
                  <td>{b.code}</td>
                  <td>{b.name}</td>
                  <td>{b.address}</td>
                  <td>{b.isActive ? "Aktif" : "Nonaktif"}</td>
                  <td>
                    {can("branch.manage") && (
                      <button className="text-xs text-brand-600" onClick={() => setEditingBranch(b)}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingBranch && (
        <BranchEditModal
          branch={editingBranch}
          onClose={() => setEditingBranch(null)}
          onSaved={() => {
            setEditingBranch(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function BranchEditModal({ branch, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    code: branch.code ?? "",
    name: branch.name ?? "",
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    isActive: branch.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.put(`/branches/${branch.id}`, form);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan cabang");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit Cabang" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input required className="input" placeholder="Kode cabang" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input required className="input" placeholder="Nama cabang" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Alamat" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input className="input" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Cabang aktif
        </label>
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
