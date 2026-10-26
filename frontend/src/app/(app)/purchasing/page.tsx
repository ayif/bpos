"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import TabBar from "@/components/TabBar";
import Modal from "@/components/Modal";
import { Check, Pencil, X } from "lucide-react";

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
  const [tab, setTab] = useState<"suppliers" | "orders" | "receipts" | "restock">("orders");
  const { data: suppliers, mutate: mutateSuppliers } = useSWR("/purchasing/suppliers", fetcher);
  const { data: products } = useSWR("/products?pageSize=100", fetcher);
  const { data: orders, mutate: mutateOrders } = useSWR("/purchasing/purchase-orders", fetcher);
  const { data: receipts, mutate: mutateReceipts } = useSWR("/purchasing/goods-receipts", fetcher);

  return (
    <div className="space-y-4">
      <div className="page-heading mb-0">
        <div>
          <h1 className="page-title">Pembelian & Supplier</h1>
          <p className="page-subtitle">Kelola supplier, purchase order, dan penerimaan barang.</p>
        </div>
      </div>
      <TabBar
        value={tab}
        onChange={setTab}
        options={[
          { value: "suppliers", label: "Supplier" },
          { value: "orders", label: "Purchase Order" },
          { value: "receipts", label: "Penerimaan Barang" },
          { value: "restock", label: "Saran Restock" },
        ]}
      />

      {tab === "suppliers" && <SupplierPanel suppliers={suppliers ?? []} onSaved={() => mutateSuppliers()} />}
      {tab === "orders" && (
        <OrderPanel suppliers={suppliers ?? []} products={products?.items ?? []} orders={orders ?? []} onSaved={() => mutateOrders()} />
      )}
      {tab === "receipts" && (
        <ReceiptPanel products={products?.items ?? []} orders={orders ?? []} receipts={receipts ?? []} onSaved={() => mutateReceipts()} />
      )}
      {tab === "restock" && (
        <ReorderSuggestionsPanel
          suppliers={suppliers ?? []}
          onOrderCreated={() => {
            mutateOrders();
            setTab("orders");
          }}
        />
      )}
    </div>
  );
}

interface ReorderSuggestion {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  currentStock: number;
  minStock: number;
  soldQty: number;
  averageDailySales: number;
  targetStock: number;
  recommendedQty: number;
  unitCost: number;
}

function ReorderSuggestionsPanel({
  suppliers,
  onOrderCreated,
}: {
  suppliers: any[];
  onOrderCreated: () => void;
}) {
  const { can } = useAuth();
  const [historyDays, setHistoryDays] = useState(30);
  const [coverDays, setCoverDays] = useState(14);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error: suggestionsError, isLoading } = useSWR(
    `/purchasing/reorder-suggestions?days=${historyDays}&coverDays=${coverDays}`,
    fetcher
  );
  const suggestions: ReorderSuggestion[] = data?.items ?? [];

  useEffect(() => {
    setSelectedIds(suggestions.map((item) => item.productId));
  }, [data]);

  async function createPurchaseOrder() {
    const selectedItems = suggestions.filter((item) => selectedIds.includes(item.productId));
    if (!supplierId || selectedItems.length === 0) return;

    setError(null);
    setBusy(true);
    try {
      await api.post("/purchasing/purchase-orders", {
        supplierId,
        note: `Draft dari saran restock (${historyDays} hari histori, target stok ${coverDays} hari)`,
        items: selectedItems.map((item) => ({
          productId: item.productId,
          qty: item.recommendedQty,
          unitCost: item.unitCost,
        })),
      });
      onOrderCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal membuat draft PO dari saran restock");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="reorder-history-days">Periode histori penjualan</label>
          <select
            id="reorder-history-days"
            className="input min-w-40"
            value={historyDays}
            onChange={(event) => setHistoryDays(Number(event.target.value))}
          >
            <option value={14}>14 hari</option>
            <option value={30}>30 hari</option>
            <option value={60}>60 hari</option>
            <option value={90}>90 hari</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="reorder-cover-days">Target cakupan stok</label>
          <select
            id="reorder-cover-days"
            className="input min-w-40"
            value={coverDays}
            onChange={(event) => setCoverDays(Number(event.target.value))}
          >
            <option value={7}>7 hari</option>
            <option value={14}>14 hari</option>
            <option value={30}>30 hari</option>
          </select>
        </div>
        <p className="text-xs text-gray-500 flex-1 basis-full">
          Saran dihitung dari rata-rata penjualan selesai dan stok minimum produk. Periksa jumlah dan harga sebelum mengirim PO untuk persetujuan.
        </p>
      </div>

      {can("purchasing.manage") && suggestions.length > 0 && (
        <div className="card flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-52">
            <label className="label" htmlFor="reorder-supplier">Supplier untuk draft PO</label>
            <select
              id="reorder-supplier"
              className="input"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">Pilih supplier</option>
              {suppliers.map((supplier: any) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !supplierId || selectedIds.length === 0}
            onClick={createPurchaseOrder}
          >
            {busy ? "Membuat PO..." : `Buat Draft PO (${selectedIds.length} produk)`}
          </button>
          {error && <p role="alert" className="text-xs text-red-600 basis-full">{error}</p>}
        </div>
      )}

      <div className="card overflow-x-auto min-w-0">
        {suggestionsError ? (
          <p role="alert" className="text-sm text-red-600">
            {suggestionsError instanceof ApiClientError
              ? suggestionsError.message
              : "Gagal memuat saran restock. Silakan coba lagi."}
          </p>
        ) : isLoading ? (
          <p className="text-sm text-gray-400 animate-pulse">Menghitung saran restock...</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada produk yang perlu direstock berdasarkan stok dan penjualan pada periode ini.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {can("purchasing.manage") && <th>Pilih</th>}
                <th>SKU</th>
                <th>Produk</th>
                <th>Kategori</th>
                <th>Stok</th>
                <th>Min. Stok</th>
                <th>Terjual</th>
                <th>Saran Beli</th>
                {can("purchasing.manage") && <th>Estimasi Modal</th>}
              </tr>
            </thead>
            <tbody>
              {suggestions.map((item) => (
                <tr key={item.productId}>
                  {can("purchasing.manage") && (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${item.name} untuk PO`}
                        checked={selectedIds.includes(item.productId)}
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, item.productId]
                              : current.filter((id) => id !== item.productId)
                          )
                        }
                      />
                    </td>
                  )}
                  <td className="font-mono text-xs">{item.sku}</td>
                  <td className="font-medium">{item.name}</td>
                  <td>{item.category ?? "-"}</td>
                  <td>{item.currentStock}</td>
                  <td>{item.minStock}</td>
                  <td>{item.soldQty}</td>
                  <td className="font-semibold text-amber-700">{item.recommendedQty}</td>
                  {can("purchasing.manage") && <td>{formatCurrency(item.recommendedQty * item.unitCost)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
              <th>Aksi</th>
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
                    <button className="btn-action btn-action-blue" onClick={() => setEditingSupplier(s)}>
                      <Pencil className="h-3.5 w-3.5" />
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
                      <div className="flex gap-1.5">
                        <button
                          className="btn-action btn-action-green"
                          disabled={decidingId === o.id}
                          onClick={() => decide(o.id, "approve")}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Setujui
                        </button>
                        <button
                          className="btn-action btn-action-red"
                          disabled={decidingId === o.id}
                          onClick={() => decide(o.id, "reject")}
                        >
                          <X className="h-3.5 w-3.5" />
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
