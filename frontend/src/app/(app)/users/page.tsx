"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";

const fetcher = (path: string) => api.get(path);

export default function UsersPage() {
  const { data: users, mutate } = useSWR("/users", fetcher);
  const { data: roles } = useSWR("/users/roles", fetcher);
  const { data: branches } = useSWR("/branches", fetcher);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "", branchIds: [] as string[] });
  const [error, setError] = useState<string | null>(null);

  function toggleBranch(id: string) {
    setForm((prev) => ({
      ...prev,
      branchIds: prev.branchIds.includes(id) ? prev.branchIds.filter((b) => b !== id) : [...prev.branchIds, id],
    }));
  }

  async function submit() {
    setError(null);
    try {
      await api.post("/users", form);
      setForm({ name: "", email: "", password: "", roleId: "", branchIds: [] });
      mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal membuat pengguna");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Manajemen Pengguna</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card space-y-2">
          <h3 className="font-medium text-sm">Pengguna Baru</h3>
          <input className="input" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
            <option value="">Role</option>
            {roles?.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <div>
            <p className="text-xs text-gray-500 mb-1">Akses Cabang</p>
            <div className="space-y-1">
              {branches?.map((b: any) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} />
                  {b.name}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button className="btn-primary w-full" onClick={submit}>
            Simpan
          </button>
        </div>
        <div className="card md:col-span-2 overflow-x-auto min-w-0">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Cabang</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u: any) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role?.name}</td>
                  <td>{u.branches?.map((b: any) => b.branch?.name).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
