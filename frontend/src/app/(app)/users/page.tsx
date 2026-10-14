"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import Modal from "@/components/Modal";
import { Pencil, Power } from "lucide-react";

const fetcher = (path: string) => api.get(path);

export default function UsersPage() {
  const { data: users, mutate } = useSWR("/users", fetcher);
  const { data: roles } = useSWR("/users/roles", fetcher);
  const { data: branches } = useSWR("/branches", fetcher);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "", branchIds: [] as string[] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function toggleStatus(u: any) {
    setToggleError(null);
    setTogglingId(u.id);
    try {
      await api.put(`/users/${u.id}`, { isActive: u.isActive === false });
      mutate();
    } catch (err) {
      setToggleError(err instanceof ApiClientError ? err.message : "Gagal mengubah status pengguna");
    } finally {
      setTogglingId(null);
    }
  }

  function toggleBranch(id: string) {
    setForm((prev) => ({
      ...prev,
      branchIds: prev.branchIds.includes(id) ? prev.branchIds.filter((b) => b !== id) : [...prev.branchIds, id],
    }));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await api.post("/users", form);
      setForm({ name: "", email: "", password: "", roleId: "", branchIds: [] });
      mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal membuat pengguna");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-heading mb-0">
        <div>
          <h1 className="page-title">Manajemen Pengguna</h1>
          <p className="page-subtitle">Atur akun, peran, status, dan akses cabang.</p>
        </div>
      </div>
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
          <button className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
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
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u: any) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role?.name}</td>
                  <td>{u.branches?.map((b: any) => b.branch?.name).join(", ")}</td>
                  <td>
                    <button
                      className={`btn-action ${u.isActive === false ? "btn-action-neutral" : "btn-action-green"}`}
                      onClick={() => toggleStatus(u)}
                      disabled={togglingId === u.id}
                      title="Klik untuk mengubah status"
                    >
                      <Power className="h-3.5 w-3.5" />
                      {togglingId === u.id ? "Memproses" : u.isActive === false ? "Nonaktif" : "Aktif"}
                    </button>
                  </td>
                  <td>
                    <button className="btn-action btn-action-blue" onClick={() => setEditingUser(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {toggleError && <p className="text-xs text-red-600 mt-2">{toggleError}</p>}
        </div>
      </div>

      {editingUser && (
        <UserEditModal
          user={editingUser}
          roles={roles ?? []}
          branches={branches ?? []}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function UserEditModal({ user, roles, branches, onClose, onSaved }: any) {
  const initialBranchIds = (user.branches ?? []).map((b: any) => b.branchId ?? b.branch?.id).filter(Boolean);
  const initialDefault = (user.branches ?? []).find((b: any) => b.isDefault)?.branchId ?? (user.branches?.[0]?.branchId ?? user.branches?.[0]?.branch?.id ?? "");

  const [form, setForm] = useState({
    name: user.name ?? "",
    roleId: user.roleId ?? user.role?.id ?? "",
    isActive: user.isActive ?? true,
    password: "",
    branchIds: initialBranchIds as string[],
    defaultBranchId: initialDefault as string,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleBranch(id: string) {
    setForm((prev) => {
      const branchIds = prev.branchIds.includes(id) ? prev.branchIds.filter((b) => b !== id) : [...prev.branchIds, id];
      const defaultBranchId = branchIds.includes(prev.defaultBranchId) ? prev.defaultBranchId : branchIds[0] ?? "";
      return { ...prev, branchIds, defaultBranchId };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.branchIds.length === 0) {
      setError("Pilih minimal satu cabang");
      return;
    }
    setBusy(true);
    try {
      await api.put(`/users/${user.id}`, {
        name: form.name,
        roleId: form.roleId,
        isActive: form.isActive,
        password: form.password || undefined,
      });
      await api.post(`/users/${user.id}/branches`, {
        branchIds: form.branchIds,
        defaultBranchId: form.defaultBranchId,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan pengguna");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit Pengguna — ${user.email}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input required className="input" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input
          className="input"
          placeholder="Password baru (kosongkan jika tidak diubah)"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <select className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
          <option value="">Role</option>
          {roles.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Pengguna aktif
        </label>
        <div>
          <p className="text-xs text-gray-500 mb-1">Akses Cabang (klik nama cabang untuk jadikan default)</p>
          <div className="space-y-1">
            {branches.map((b: any) => (
              <div key={b.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} />
                <button
                  type="button"
                  className={form.defaultBranchId === b.id ? "text-brand-700 font-medium" : "text-gray-700"}
                  disabled={!form.branchIds.includes(b.id)}
                  onClick={() => setForm({ ...form, defaultBranchId: b.id })}
                >
                  {b.name}
                  {form.defaultBranchId === b.id && " (default)"}
                </button>
              </div>
            ))}
          </div>
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
