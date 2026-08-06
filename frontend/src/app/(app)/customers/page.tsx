"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (path: string) => api.get(path);

export default function CustomersPage() {
  const { data: customers, mutate } = useSWR("/customers", fetcher);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  async function submit() {
    if (!form.name) return;
    await api.post("/customers", form);
    setForm({ name: "", phone: "", email: "" });
    mutate();
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
          <button className="btn-primary w-full" onClick={submit}>
            Simpan
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
              </tr>
            </thead>
            <tbody>
              {customers?.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.points}</td>
                  <td>{c.priceLevel?.name ?? "Retail"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
