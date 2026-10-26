"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { api, ApiClientError, downloadFile } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import TabBar from "@/components/TabBar";
import { Search, Trash2, PackageSearch, CheckCircle2 } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import Modal from "@/components/Modal";

const fetcher = (path: string) => api.get(path);

interface CartLine {
  productId: string;
  name: string;
  sellPrice: number;
  qty: number;
  discount: number;
}

export default function PosPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"kasir" | "retur">("kasir");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [discountTotal, setDiscountTotal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [paidAmount, setPaidAmount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  const { data: productsData } = useSWR(`/products?q=${encodeURIComponent(query)}&pageSize=20`, fetcher);
  const { data: customers } = useSWR("/customers", fetcher);
  const { data: currentShift } = useSWR("/shift/current", fetcher);

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.sellPrice * l.qty - l.discount, 0), [cart]);
  const grandTotal = Math.max(subtotal - discountTotal, 0);
  const change = Math.max(paidAmount - grandTotal, 0);

  function addToCart(p: any) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { productId: p.id, name: p.name, sellPrice: Number(p.sellPrice), qty: 1, discount: 0 }];
    });
  }

  function updateQty(productId: string, qty: number) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, qty: Math.max(1, qty) } : l)));
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function requestCheckout() {
    setMessage(null);
    setSuccessMessage(null);
    if (cart.length === 0) {
      setMessage("Keranjang masih kosong");
      return;
    }
    if (paidAmount < grandTotal) {
      setMessage("Jumlah bayar kurang dari total");
      return;
    }
    setShowConfirmation(true);
  }

  async function handleCheckout() {
    setMessage(null);
    setIsCheckingOut(true);
    try {
      const sale = await api.post("/pos/sales", {
        customerId: customerId || undefined,
        shiftId: currentShift?.id,
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty, discount: l.discount })),
        discountTotal,
        payments: [{ method: paymentMethod, amount: paidAmount }],
      });
      setLastSale(sale);
      setCart([]);
      setDiscountTotal(0);
      setPaidAmount(0);
      setCustomerId("");
      setShowConfirmation(false);
      setSuccessMessage(`Transaksi ${sale.invoiceNo} berhasil diselesaikan.`);
    } catch (err) {
      setShowConfirmation(false);
      setMessage(err instanceof ApiClientError ? err.message : "Gagal memproses transaksi");
    } finally {
      setIsCheckingOut(false);
    }
  }

  if (currentShift === undefined) {
    return <div className="text-sm text-gray-400 animate-pulse">Memuat...</div>;
  }

  const canRefund = can("pos.refund");

  return (
    <div className="space-y-5">
      <div className="page-heading mb-0">
        <div>
          <h1 className="page-title">Kasir (POS)</h1>
          <p className="page-subtitle">Pindai atau cari produk, lalu selesaikan pembayaran.</p>
        </div>
        {currentShift && <span className="badge-green">Shift berjalan</span>}
      </div>
      {canRefund && (
        <TabBar
          value={tab}
          onChange={setTab}
          options={[
            { value: "kasir", label: "Kasir" },
            { value: "retur", label: "Retur" },
          ]}
        />
      )}

      {showConfirmation && (
        <Modal title="Confirmation" onClose={() => !isCheckingOut && setShowConfirmation(false)}>
          <div role="alertdialog" aria-labelledby="checkout-confirmation" className="space-y-5">
            <p id="checkout-confirmation" className="text-sm text-gray-600">
              Apakah anda yakin memproses transaksi ini?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary min-w-24"
                onClick={() => setShowConfirmation(false)}
                disabled={isCheckingOut}
              >
                No
              </button>
              <button type="button" className="btn-primary min-w-24" onClick={handleCheckout} disabled={isCheckingOut}>
                {isCheckingOut ? "Memproses..." : "Yes"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {successMessage && (
        <Modal title="Transaksi Berhasil" onClose={() => setSuccessMessage(null)}>
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="success-checkmark rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-gray-700">{successMessage}</p>
            <button type="button" className="btn-primary w-full" onClick={() => setSuccessMessage(null)}>
              Selesai
            </button>
          </div>
        </Modal>
      )}

      {tab === "retur" && canRefund ? (
        <ReturnPanel />
      ) : !currentShift ? (
        <OpenShiftPrompt onOpened={() => window.location.reload()} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Cari produk (nama/SKU/barcode)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {productsData?.items?.map((p: any) => (
            <button key={p.id} onClick={() => addToCart(p)} className="card text-left hover:shadow-md hover:border-brand-200 transition-all">
              <div className="-mx-5 -mt-5 mb-3 overflow-hidden rounded-t-xl">
                <ProductImage key={p.imageUrl ?? "empty"} src={p.imageUrl} name={p.name} className="h-28 w-full" iconClassName="h-8 w-8" />
              </div>
              <div className="font-semibold text-sm text-gray-900 line-clamp-2 min-h-10">{p.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{p.sku}</div>
              <div className="flex items-center justify-between gap-2 mt-2">
                <div className="text-sm font-bold text-brand-700">{formatCurrency(p.sellPrice)}</div>
                <span className="rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-500">Stok {p.stocks?.[0]?.qty ?? 0}</span>
              </div>
            </button>
          ))}
          {productsData?.items?.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 py-10 text-gray-400">
              <PackageSearch className="h-8 w-8" />
              <p className="text-sm">Produk tidak ditemukan.</p>
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-3 h-fit sticky top-6">
        <h2 className="font-medium text-gray-900">Keranjang</h2>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {cart.map((l) => (
            <div key={l.productId} className="flex items-center justify-between text-sm gap-2">
              <div className="flex-1 min-w-0">
                <div className="truncate text-gray-900">{l.name}</div>
                <div className="text-xs text-gray-500">{formatCurrency(l.sellPrice)}</div>
              </div>
              <input
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) => updateQty(l.productId, parseInt(e.target.value, 10) || 1)}
                className="w-14 rounded-md border border-gray-300 px-1 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <button
                onClick={() => removeLine(l.productId)}
                className="btn-action btn-action-red !p-1.5 shrink-0"
                aria-label={`Hapus ${l.name} dari keranjang`}
                title="Hapus dari keranjang"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {cart.length === 0 && <p className="text-xs text-gray-400">Belum ada item</p>}
        </div>

        <div>
          <label className="label">Pelanggan (opsional)</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">- Umum -</option>
            {customers?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.points} poin)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Diskon Total (Rp)</label>
          <input type="number" min={0} className="input" value={discountTotal} onChange={(e) => setDiscountTotal(Number(e.target.value))} />
        </div>

        <div className="text-sm space-y-1 border-t border-gray-100 pt-3">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between font-semibold text-base text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        <div>
          <label className="label">Metode Pembayaran</label>
          <div className="flex gap-2">
            {(["CASH", "TRANSFER", "QRIS"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors ${
                  paymentMethod === m ? "bg-brand-600 text-white border-brand-600 shadow-soft" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Jumlah Bayar</label>
          <input type="number" min={0} className="input" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Kembalian</span>
          <span className="font-medium text-gray-900">{formatCurrency(change)}</span>
        </div>

        {message && <p className="text-xs text-brand-700 bg-brand-50 rounded-md px-2.5 py-1.5">{message}</p>}

        <button onClick={requestCheckout} className="btn-primary w-full">
          Bayar
        </button>

        {lastSale && (
          <button className="btn-secondary w-full" onClick={() => downloadFile(`/pos/sales/${lastSale.id}/receipt.pdf`, `struk-${lastSale.invoiceNo}.pdf`)}>
            Cetak Struk PDF
          </button>
        )}
      </div>
        </div>
      )}
    </div>
  );
}

function OpenShiftPrompt({ onOpened }: { onOpened: () => void }) {
  const [openingCash, setOpeningCash] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/shift/open", { openingCash });
      onOpened();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal membuka shift");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto card mt-12">
      <h2 className="font-medium text-gray-900 mb-3">Buka Shift Kasir</h2>
      <label className="label">Modal Awal (Rp)</label>
      <input type="number" min={0} className="input mb-3" value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value))} />
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <button onClick={handleOpen} disabled={busy} className="btn-primary w-full">
        {busy ? "Membuka..." : "Buka Shift"}
      </button>
    </div>
  );
}

function ReturnPanel() {
  const { data: sales } = useSWR("/pos/sales", fetcher);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const { data: sale } = useSWR(selectedSaleId ? `/pos/sales/${selectedSaleId}` : null, fetcher);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function selectSale(id: string) {
    setSelectedSaleId(id);
    setQtyMap({});
    setReason("");
    setError(null);
    setMessage(null);
  }

  async function submitReturn() {
    if (!sale) return;
    const items = Object.entries(qtyMap)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, qty]) => ({ saleItemId, qty }));
    if (items.length === 0) {
      setError("Pilih minimal satu item untuk diretur");
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await api.post(`/pos/sales/${sale.id}/return`, { items, reason: reason || undefined });
      setMessage("Retur berhasil diproses.");
      setQtyMap({});
      setReason("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal memproses retur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="card overflow-y-auto max-h-[70vh]">
        <h2 className="font-medium text-gray-900 mb-2">Transaksi Terbaru</h2>
        <div className="space-y-1">
          {sales?.map((s: any) => (
            <button
              key={s.id}
              onClick={() => selectSale(s.id)}
              className={`w-full text-left text-sm px-2.5 py-2 rounded-lg transition-colors ${
                selectedSaleId === s.id ? "bg-brand-50 text-brand-700" : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <div className="font-medium">{s.invoiceNo}</div>
              <div className="text-xs text-gray-400">
                {formatCurrency(s.grandTotal)} · {s.status}
              </div>
            </button>
          ))}
          {sales?.length === 0 && <p className="text-xs text-gray-400">Belum ada transaksi</p>}
        </div>
      </div>

      <div className="card lg:col-span-2">
        {!sale ? (
          <p className="text-sm text-gray-400">Pilih transaksi di sebelah kiri untuk memproses retur.</p>
        ) : (
          <div className="space-y-3">
            <h2 className="font-medium text-gray-900">Retur — {sale.invoiceNo}</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Qty Terjual</th>
                  <th>Qty Retur</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.product?.name ?? item.productId}</td>
                    <td>{item.qty}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={item.qty}
                        className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        value={qtyMap[item.id] ?? 0}
                        onChange={(e) =>
                          setQtyMap((prev) => ({ ...prev, [item.id]: Math.min(item.qty, Math.max(0, Number(e.target.value))) }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <input className="input" placeholder="Alasan retur (opsional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            {error && <p className="text-xs text-red-600">{error}</p>}
            {message && <p className="text-xs text-green-700 bg-green-50 rounded-md px-2.5 py-1.5">{message}</p>}
            <button className="btn-primary" onClick={submitReturn} disabled={busy}>
              {busy ? "Memproses..." : "Proses Retur"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
