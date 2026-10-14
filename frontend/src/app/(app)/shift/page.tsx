"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

const fetcher = (path: string) => api.get(path);

export default function ShiftPage() {
  const { data: current, mutate: mutateCurrent } = useSWR("/shift/current", fetcher);
  const { data: shifts, mutate } = useSWR("/shift", fetcher);
  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  async function openShift() {
    try {
      await api.post("/shift/open", { openingCash });
      mutateCurrent();
      mutate();
    } catch (err) {
      setMessage(err instanceof ApiClientError ? err.message : "Gagal membuka shift");
    }
  }

  async function closeShift() {
    if (!current) return;
    try {
      await api.post(`/shift/${current.id}/close`, { closingCash });
      mutateCurrent();
      mutate();
      setMessage("Shift ditutup.");
    } catch (err) {
      setMessage(err instanceof ApiClientError ? err.message : "Gagal menutup shift");
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-heading mb-0">
        <div>
          <h1 className="page-title">Shift Kasir</h1>
          <p className="page-subtitle">Kelola kas awal, penutupan shift, dan selisih kas.</p>
        </div>
      </div>

      <div className="card space-y-2 max-w-sm">
        {!current ? (
          <>
            <h3 className="font-medium text-sm">Buka Shift</h3>
            <input type="number" className="input" placeholder="Modal awal" value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value))} />
            <button className="btn-primary w-full" onClick={openShift}>
              Buka Shift
            </button>
          </>
        ) : (
          <>
            <h3 className="font-medium text-sm">Shift Sedang Berjalan</h3>
            <p className="text-sm">Modal awal: {formatCurrency(current.openingCash)}</p>
            <p className="text-sm">Dibuka: {formatDate(current.openedAt)}</p>
            <input type="number" className="input" placeholder="Uang kas saat tutup" value={closingCash} onChange={(e) => setClosingCash(Number(e.target.value))} />
            <button className="btn-danger w-full" onClick={closeShift}>
              Tutup Shift
            </button>
          </>
        )}
        {message && <p className="text-xs text-brand-700">{message}</p>}
      </div>

      <div className="card overflow-x-auto min-w-0">
        <h3 className="font-medium text-sm mb-2">Riwayat Shift</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Kasir</th>
              <th>Modal Awal</th>
              <th>Kas Akhir</th>
              <th>Selisih</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shifts?.map((s: any) => (
              <tr key={s.id}>
                <td>{s.user?.name}</td>
                <td>{formatCurrency(s.openingCash)}</td>
                <td>{s.closingCash ? formatCurrency(s.closingCash) : "-"}</td>
                <td>{s.difference ? formatCurrency(s.difference) : "-"}</td>
                <td>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
