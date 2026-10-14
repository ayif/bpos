"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, ApiClientError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import TabBar from "@/components/TabBar";

const fetcher = (path: string) => api.get(path);

export default function AccountingPage() {
  const { can, user, activeBranchId } = useAuth();
  const [tab, setTab] = useState<"pl" | "bs" | "cf" | "coa" | "gl" | "tax">("pl");
  const [from, setFrom] = useState(() => dateInputDaysAgo(30));
  const [to, setTo] = useState(() => dateInputToday());
  const [branchId, setBranchId] = useState("");
  useEffect(() => {
    if (activeBranchId) setBranchId(activeBranchId);
  }, [activeBranchId]);

  const reportQuery = buildReportQuery(from, to, branchId);
  const { data: pl } = useSWR(tab === "pl" ? `/accounting/reports/profit-loss${reportQuery}` : null, fetcher);
  const { data: bs } = useSWR(tab === "bs" ? `/accounting/reports/balance-sheet${reportQuery}` : null, fetcher);
  const { data: cf } = useSWR(tab === "cf" ? `/accounting/reports/cash-flow${reportQuery}` : null, fetcher);
  const { data: accounts, mutate: mutateAccounts } = useSWR(tab === "coa" || tab === "gl" ? "/accounting/accounts" : null, fetcher);
  const { data: tax } = useSWR(tab === "tax" ? `/accounting/reports/tax-report${reportQuery}` : null, fetcher);
  const activeReport = tab === "pl" ? pl : tab === "bs" ? bs : tab === "cf" ? cf : tab === "tax" ? tax : null;

  return (
    <div className="space-y-4">
      <div className="page-heading mb-0">
        <div>
          <h1 className="page-title">Akuntansi</h1>
          <p className="page-subtitle">Laporan keuangan, buku besar, dan chart of accounts.</p>
        </div>
      </div>
      {tab !== "coa" && (
        <div className="card flex flex-wrap items-end gap-3">
          {tab !== "bs" && (
            <label className="label">
              Dari
              <input className="input mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
          )}
          <label className="label">
            {tab === "bs" ? "Per tanggal" : "Sampai"}
            <input className="input mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="label min-w-48">
            Cabang
            <select className="input mt-1" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Semua cabang yang dapat diakses</option>
              {(user?.branches ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>
          {activeReport && (
            <button className="btn-secondary" onClick={() => exportAccountingCsv(tab, activeReport)}>
              Export CSV
            </button>
          )}
        </div>
      )}
      <TabBar
        value={tab}
        onChange={setTab}
        options={[
          { value: "pl", label: "Laba Rugi" },
          { value: "bs", label: "Neraca" },
          { value: "cf", label: "Arus Kas" },
          { value: "gl", label: "Buku Besar" },
          { value: "tax", label: "Pajak" },
          { value: "coa", label: "Chart of Accounts" },
        ]}
      />

      {tab === "pl" && pl && (
        <div className="card space-y-3">
          <h3 className="font-medium text-sm">Pendapatan</h3>
          {pl.revenue.map((r: any) => (
            <div key={r.code} className="flex justify-between text-sm">
              <span>{r.name}</span>
              <span>{formatCurrency(r.amount)}</span>
            </div>
          ))}
          <h3 className="font-medium text-sm pt-2">Beban</h3>
          {pl.expense.map((r: any) => (
            <div key={r.code} className="flex justify-between text-sm">
              <span>{r.name}</span>
              <span>{formatCurrency(r.amount)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Laba Bersih</span>
            <span>{formatCurrency(pl.netProfit)}</span>
          </div>
        </div>
      )}

      {tab === "bs" && bs && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card space-y-2">
            <h3 className="font-medium text-sm">Aset</h3>
            {bs.assets.map((a: any) => (
              <div key={a.code} className="flex justify-between text-sm">
                <span>{a.name}</span>
                <span>{formatCurrency(a.amount)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total Aset</span>
              <span>{formatCurrency(bs.totalAssets)}</span>
            </div>
          </div>
          <div className="card space-y-2">
            <h3 className="font-medium text-sm">Kewajiban & Modal</h3>
            {bs.liabilities.map((l: any) => (
              <div key={l.code} className="flex justify-between text-sm">
                <span>{l.name}</span>
                <span>{formatCurrency(l.amount)}</span>
              </div>
            ))}
            {bs.equity.map((e: any) => (
              <div key={e.code} className="flex justify-between text-sm">
                <span>{e.name}</span>
                <span>{formatCurrency(e.amount)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatCurrency(bs.totalLiabilities + bs.totalEquity)}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "cf" && cf && (
        <div className="card space-y-2">
          <div className="flex justify-between text-sm">
            <span>Kas Masuk</span>
            <span>{formatCurrency(cf.cashIn)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Kas Keluar</span>
            <span>{formatCurrency(cf.cashOut)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Arus Kas Bersih</span>
            <span>{formatCurrency(cf.netCashFlow)}</span>
          </div>
        </div>
      )}

      {tab === "gl" && <GeneralLedgerPanel accounts={accounts ?? []} reportQuery={reportQuery} />}

      {tab === "tax" && tax && (
        <div className="card space-y-2">
          <div className="flex justify-between text-sm">
            <span>PPN Keluaran (Penjualan)</span>
            <span>{formatCurrency(tax.outputTax)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>PPN Masukan (Pembelian)</span>
            <span>{formatCurrency(tax.inputTax)}</span>
          </div>
          <p className="text-xs text-amber-600">{tax.inputTaxNote}</p>
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Hutang Pajak (Kurang/Lebih Bayar)</span>
            <span>{formatCurrency(tax.taxPayable)}</span>
          </div>
          <table className="table mt-3">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kode Jurnal</th>
                <th>Keterangan</th>
                <th>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {tax.transactions.map((t: any, i: number) => (
                <tr key={i}>
                  <td>{new Date(t.date).toLocaleDateString("id-ID")}</td>
                  <td>{t.entryCode}</td>
                  <td>{t.description}</td>
                  <td>{formatCurrency(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "coa" && accounts && (
        <div className="space-y-4">
          {can("accounting.manage") && <CoaForm onSaved={() => mutateAccounts()} />}
          <div className="card overflow-x-auto min-w-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Akun</th>
                  <th>Tipe</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.code}</td>
                    <td>{a.name}</td>
                    <td>{a.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

function CoaForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ code: "", name: "", type: "ASSET" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.code || !form.name) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/accounting/accounts", form);
      setForm({ code: "", name: "", type: "ASSET" });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan akun");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-2 max-w-md">
      <h3 className="font-medium text-sm">Akun Baru</h3>
      <div className="grid grid-cols-3 gap-2">
        <input className="input" placeholder="Kode" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input className="input col-span-2" placeholder="Nama akun" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
        {ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button className="btn-primary w-full" onClick={submit} disabled={busy}>
        {busy ? "Menyimpan..." : "Simpan"}
      </button>
    </div>
  );
}

function GeneralLedgerPanel({ accounts, reportQuery }: { accounts: any[]; reportQuery: string }) {
  const [accountId, setAccountId] = useState("");
  const ledgerQuery = new URLSearchParams(reportQuery.replace(/^\?/, ""));
  if (accountId) ledgerQuery.set("accountId", accountId);
  const { data: ledger } = useSWR(accountId ? `/accounting/reports/general-ledger?${ledgerQuery.toString()}` : null, fetcher);

  return (
    <div className="space-y-3">
      <select className="input max-w-xs" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        <option value="">Pilih akun...</option>
        {accounts.map((a: any) => (
          <option key={a.id} value={a.id}>
            {a.code} - {a.name}
          </option>
        ))}
      </select>

      {ledger && (
        <button className="btn-secondary" onClick={() => exportAccountingCsv("gl", ledger)}>
          Export CSV
        </button>
      )}

      {ledger && (
        <div className="card overflow-x-auto min-w-0 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Saldo Awal</span>
            <span>{formatCurrency(ledger.openingBalance)}</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kode Jurnal</th>
                <th>Keterangan</th>
                <th>Debit</th>
                <th>Kredit</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {ledger.lines.map((l: any, i: number) => (
                <tr key={i}>
                  <td>{new Date(l.date).toLocaleDateString("id-ID")}</td>
                  <td>{l.entryCode}</td>
                  <td>{l.description}</td>
                  <td>{l.debit > 0 ? formatCurrency(l.debit) : "-"}</td>
                  <td>{l.credit > 0 ? formatCurrency(l.credit) : "-"}</td>
                  <td>{formatCurrency(l.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Saldo Akhir</span>
            <span>{formatCurrency(ledger.closingBalance)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function dateInputToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateInputDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildReportQuery(from: string, to: string, branchId: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (branchId) params.set("branchId", branchId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function exportAccountingCsv(tab: string, report: any) {
  let rows: (string | number)[][];
  let filename: string;

  if (tab === "pl") {
    filename = "laba-rugi.csv";
    rows = [["Bagian", "Kode akun", "Nama akun", "Jumlah"]];
    report.revenue.forEach((item: any) => rows.push(["Pendapatan", item.code, item.name, item.amount]));
    report.expense.forEach((item: any) => rows.push(["Beban", item.code, item.name, item.amount]));
    rows.push(["Total", "", "Pendapatan", report.totalRevenue]);
    rows.push(["Total", "", "Beban", report.totalExpense]);
    rows.push(["Total", "", "Laba Bersih", report.netProfit]);
  } else if (tab === "bs") {
    filename = "neraca.csv";
    rows = [["Bagian", "Kode akun", "Nama akun", "Jumlah"]];
    report.assets.forEach((item: any) => rows.push(["Aset", item.code, item.name, item.amount]));
    report.liabilities.forEach((item: any) => rows.push(["Kewajiban", item.code, item.name, item.amount]));
    report.equity.forEach((item: any) => rows.push(["Modal", item.code, item.name, item.amount]));
    rows.push(["Total", "", "Total Aset", report.totalAssets]);
    rows.push(["Total", "", "Total Kewajiban", report.totalLiabilities]);
    rows.push(["Total", "", "Total Modal", report.totalEquity]);
  } else if (tab === "cf") {
    filename = "arus-kas.csv";
    rows = [["Tanggal", "Jenis referensi", "Keterangan", "Kas masuk", "Kas keluar"]];
    report.transactions.forEach((item: any) => rows.push([
      new Date(item.date).toLocaleDateString("id-ID"), item.refType ?? "", item.description ?? "", item.in, item.out,
    ]));
    rows.push(["", "", "Total", report.cashIn, report.cashOut]);
    rows.push(["", "", "Arus Kas Bersih", report.netCashFlow, ""]);
  } else if (tab === "tax") {
    filename = "laporan-pajak.csv";
    rows = [["Tanggal", "Kode jurnal", "Jenis referensi", "Keterangan", "Pajak keluaran"]];
    report.transactions.forEach((item: any) => rows.push([
      new Date(item.date).toLocaleDateString("id-ID"), item.entryCode, item.refType ?? "", item.description ?? "", item.amount,
    ]));
    rows.push(["", "", "", "Total PPN keluaran", report.outputTax]);
    rows.push(["", "", "", "PPN masukan tercatat", report.inputTax]);
    rows.push(["", "", "", "Hutang pajak", report.taxPayable]);
  } else if (tab === "gl") {
    filename = `buku-besar-${report.account.code}.csv`;
    rows = [["Tanggal", "Kode jurnal", "Keterangan", "Jenis referensi", "Debit", "Kredit", "Saldo"]];
    rows.push(["", "", "Saldo Awal", "", "", "", report.openingBalance]);
    report.lines.forEach((item: any) => rows.push([
      new Date(item.date).toLocaleDateString("id-ID"), item.entryCode, item.description ?? "", item.refType ?? "", item.debit, item.credit, item.balance,
    ]));
    rows.push(["", "", "Saldo Akhir", "", "", "", report.closingBalance]);
  } else {
    return;
  }

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
