"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Search, Trash2, PackageSearch } from "lucide-react";

const fetcher = (path: string) => api.get(path);

interface CartLine {
  productId: string;
  name: string;
  sellPrice: number;
  qty: number;
  discount: number;
}

export default function PosPage() {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [discountTotal, setDiscountTotal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [paidAmount, setPaidAmount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
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

  async function handleCheckout() {
    setMessage(null);
    if (cart.length === 0) {
      setMessage("Keranjang masih kosong");
      return;
    }
    if (paidAmount < grandTotal) {
      setMessage("Jumlah bayar kurang dari total");
      return;
    }
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
      setMessage(`Transaksi ${sale.invoiceNo} berhasil.`);
    } catch (err) {
      setMessage(err instanceof ApiClientError ? err.message : "Gagal memproses transaksi");
    }
  }

  if (currentShift === undefined) {
    return <div className="text-sm text-gray-400 animate-pulse">Memuat...</div>;
  }

  if (!currentShift) {
    return <OpenShiftPrompt onOpened={() => window.location.reload()} />;
  }

  return (
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
              <div className="font-medium text-sm text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-400">{p.sku}</div>
              <div className="text-sm font-semibold text-brand-700 mt-1.5">{formatCurrency(p.sellPrice)}</div>
              <div className="text-xs text-gray-400">Stok: {p.stocks?.[0]?.qty ?? 0}</div>
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
              <button onClick={() => removeLine(l.productId)} className="text-red-500 hover:text-red-600 shrink-0">
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

        <button onClick={handleCheckout} className="btn-primary w-full">
          Bayar
        </button>

        {lastSale && (
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/pos/sales/${lastSale.id}/receipt.pdf`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary w-full block text-center"
          >
            Cetak Struk PDF
          </a>
        )}
      </div>
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
