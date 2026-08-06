"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (path: string) => api.get(path);

export default function BranchesPage() {
  const { data: branches, mutate } = useSWR("/branches", fetcher);
  const [form, setForm] = useState({ code: "", name: "", address: "", phone: "" });

  async function submit() {
    if (!form.code || !form.name) return;
    await api.post("/branches", form);
    setForm({ code: "", name: "", address: "", phone: "" });
    mutate();
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
          <button className="btn-primary w-full" onClick={submit}>
            Simpan
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
              </tr>
            </thead>
            <tbody>
              {branches?.map((b: any) => (
                <tr key={b.id}>
                  <td>{b.code}</td>
                  <td>{b.name}</td>
                  <td>{b.address}</td>
                  <td>{b.isActive ? "Aktif" : "Nonaktif"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
