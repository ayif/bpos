"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import TabBar from "@/components/TabBar";
import Modal from "@/components/Modal";

const PO_STATUS_STYLE: Record<string, string> = {
  PENDING_APPROVAL: "badge-amber",
  APPROVED: "badge-blue",
  REJECTED: "badge-red",
  RECEIVED: "badge-green",
  CANCELLED: "badge-gray",
};

function PoStatusBadge({ status }: { status: string }) {
  return <span className={PO_STATUS_STYLE[status] ?? "badge-gray"}>{status.replace("_", " ")}</span>;
}

const fetcher = (path: string) => api.get(path);

export default function PurchasingPage() {
  const [tab, setTab] = useState<"suppliers" | "orders" | "receipts">("orders");
  const { data: suppliers, mutate: mutateSuppliers } = useSWR("/purchasing/suppliers", fetcher);
  const { data: products } = useSWR("/products?pageSize=100", fetcher);
  const { data: orders, mutate: mutateOrders } = useSWR("/purchasing/purchase-orders", fetcher);
  const { data: receipts, mutate: mutateReceipts } = useSWR("/purchasing/goods-receipts", fetcher);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Pembelian & Supplier</h1>
        <p className="text-sm text-gray-500">Kelola supplier, purchase order, dan penerimaan barang.</p>
      </div>
      <TabBar
        value={tab}
        onChange={setTab}
        options={[
          { value: "suppliers", label: "Supplier" },
          { value: "orders", label: "Purchase Order" },
          { value: "receipts", label: "Penerimaan Barang" },
        ]}
      />

      {tab === "suppliers" && <SupplierPanel suppliers={suppliers ?? []} onSaved={() => mutateSuppliers()} />}
      {tab === "orders" && (
        <OrderPanel suppliers={suppliers ?? []} products={products?.items ?? []} orders={orders ?? []} onSaved={() => mutateOrders()} />
      )}
      {tab === "receipts" && (
        <ReceiptPanel products={products?.items ?? []} orders={orders ?? []} receipts={receipts ?? []} onSaved={() => mutateReceipts()} />
      )}
    </div>
  );
}

function SupplierPanel({ suppliers, onSaved }: any) {
  const { can } = useAuth();
  const [form, setForm] = useState({ name: "", contact: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);

  async function submit() {
    if (!form.name) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/purchasing/suppliers", form);
      setForm({ name: "", contact: "", phone: "" });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan supplier");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card space-y-2">
        <h3 className="font-medium text-sm">Supplier Baru</h3>
        <input className="input" placeholder="Nama supplier" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Kontak person" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        <input className="input" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={submit} disabled={busy}>
          {busy ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
      <div className="card overflow-x-auto min-w-0">
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Kontak</th>
              <th>Telepon</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s: any) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.contact}</td>
                <td>{s.phone}</td>
                <td>
                  {can("purchasing.manage") && (
                    <button className="text-xs text-brand-600" onClick={() => setEditingSupplier(s)}>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingSupplier && (
        <SupplierEditModal
          supplier={editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onSaved={() => {
            setEditingSupplier(null);
            onSaved();
          }}
        />
      )}
    </div>
  );
}

function SupplierEditModal({ supplier, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    name: supplier.name ?? "",
    contact: supplier.contact ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    address: supplier.address ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.put(`/purchasing/suppliers/${supplier.id}`, form);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan supplier");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit Supplier" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input required className="input" placeholder="Nama supplier" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Kontak person" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        <input className="input" placeholder="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" placeholder="Alamat" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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

function OrderPanel({ suppliers, products, orders, onSaved }: any) {
  const { can } = useAuth();
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<{ productId: string; qty: number; unitCost: number }[]>([{ productId: "", qty: 1, unitCost: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await api.post("/purchasing/purchase-orders", { supplierId, items: items.filter((i) => i.productId) });
      setItems([{ productId: "", qty: 1, unitCost: 0 }]);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal membuat PO");
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    setDecidingId(id);
    setError(null);
    try {
      await api.post(`/purchasing/purchase-orders/${id}/${action}`, {});
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Gagal ${action === "approve" ? "menyetujui" : "menolak"} PO`);
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card space-y-2">
        <h3 className="font-medium text-sm">Purchase Order Baru</h3>
        <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">Supplier</option>
          {suppliers.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <select
              className="input"
              value={item.productId}
              onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, productId: e.target.value } : it)))}
            >
              <option value="">Produk</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input type="number" min={1} className="input w-16" value={item.qty} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: Number(e.target.value) } : it)))} />
            <input type="number" min={0} className="input w-24" placeholder="Harga" value={item.unitCost} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unitCost: Number(e.target.value) } : it)))} />
          </div>
        ))}
        <button className="btn-secondary text-xs" onClick={() => setItems((prev) => [...prev, { productId: "", qty: 1, unitCost: 0 }])}>
          + Baris
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={submit}>
          Buat PO
        </button>
      </div>
      <div className="card overflow-x-auto min-w-0">
        <table className="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Supplier</th>
              <th>Status</th>
              {can("purchasing.approve") && <th>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id}>
                <td>{o.code}</td>
                <td>{o.supplier?.name}</td>
                <td><PoStatusBadge status={o.status} /></td>
                {can("purchasing.approve") && (
                  <td>
                    {o.status === "PENDING_APPROVAL" ? (
                      <div className="flex gap-1">
                        <button
                          className="btn-secondary text-xs px-2 py-1"
                          disabled={decidingId === o.id}
                          onClick={() => decide(o.id, "approve")}
                        >
                          Setujui
                        </button>
                        <button
                          className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                          disabled={decidingId === o.id}
                          onClick={() => decide(o.id, "reject")}
                        >
                          Tolak
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReceiptPanel({ products, orders, receipts, onSaved }: any) {
  const [poId, setPoId] = useState("");
  const [items, setItems] = useState<{ productId: string; qty: number; unitCost: number }[]>([{ productId: "", qty: 1, unitCost: 0 }]);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await api.post("/purchasing/goods-receipts", { poId: poId || undefined, items: items.filter((i) => i.productId) });
      setItems([{ productId: "", qty: 1, unitCost: 0 }]);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menerima barang");
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card space-y-2">
        <h3 className="font-medium text-sm">Penerimaan Barang</h3>
        <select className="input" value={poId} onChange={(e) => setPoId(e.target.value)}>
          <option value="">Tanpa PO (langsung)</option>
          {orders
            .filter((o: any) => o.status === "APPROVED")
            .map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.code} - {o.supplier?.name}
              </option>
            ))}
        </select>
        <p className="text-xs text-gray-500">Hanya PO berstatus APPROVED yang dapat diterima barangnya.</p>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <select
              className="input"
              value={item.productId}
              onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, productId: e.target.value } : it)))}
            >
              <option value="">Produk</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input type="number" min={1} className="input w-16" value={item.qty} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: Number(e.target.value) } : it)))} />
            <input type="number" min={0} className="input w-24" placeholder="Harga" value={item.unitCost} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unitCost: Number(e.target.value) } : it)))} />
          </div>
        ))}
        <button className="btn-secondary text-xs" onClick={() => setItems((prev) => [...prev, { productId: "", qty: 1, unitCost: 0 }])}>
          + Baris
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={submit}>
          Terima Barang (Update Stok)
        </button>
      </div>
      <div className="card overflow-x-auto min-w-0">
        <table className="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Item</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r: any) => (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>{r.items?.length}</td>
                <td>{formatCurrency(r.items?.reduce((s: number, it: any) => s + it.qty * Number(it.unitCost), 0) ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
