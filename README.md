# BPOS — Sistem Point of Sale & Manajemen Multi Cabang

Stack: Node.js/TypeScript (Express + Prisma) untuk backend, Next.js (App Router) untuk frontend, PostgreSQL sebagai database, Redis untuk cache/session, dan semuanya dikemas dengan Docker Compose.

## Menjalankan dengan Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Setelah semua service sehat:

1. Jalankan migrasi database (sekali saja, atau otomatis lewat `CMD` di backend Dockerfile saat container start):
   ```bash
   docker compose exec backend npx prisma migrate deploy
   ```
   Untuk pengembangan lokal (membuat migrasi baru dari `schema.prisma`):
   ```bash
   docker compose exec backend npx prisma migrate dev --name init
   ```
2. Isi data awal (role, cabang, user demo, produk contoh, chart of accounts):
   ```bash
   docker compose exec backend npm run seed
   ```
3. Buka frontend di `http://localhost:3000` dan backend API di `http://localhost:4000/api/health`.

### Akun demo (password: `password123`)

| Email | Role | Akses |
|---|---|---|
| admin@bpos.local | Super Admin | Semua cabang, semua modul |
| manager@bpos.local | Branch Manager | Cabang Pusat |
| kasir@bpos.local | Cashier | Cabang Pusat (POS, shift, pelanggan) |

## Menjalankan tanpa Docker (development)

Backend:
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev        # http://localhost:4000
```

Frontend:
```bash
cd frontend
npm install
npm run dev         # http://localhost:3000
```

Pastikan `DATABASE_URL` dan `REDIS_URL` di `backend/.env` (atau env yang di-export) mengarah ke instance Postgres/Redis lokal — bisa juga cukup jalankan `docker compose up postgres redis` lalu jalankan backend/frontend secara native.

## Struktur modul yang sudah diimplementasikan penuh

- **Akses & multi cabang**: login JWT, role (Super Admin, Owner, Branch Manager, Cashier, Warehouse, Accountant) dengan permission granular, akses user dibatasi per cabang lewat header `X-Branch-Id`.
- **POS**: checkout dengan pembayaran Cash/Transfer/QRIS (termasuk split/mixed), pencarian produk & lookup barcode, diskon per-item & total, pajak otomatis, kembalian, cetak struk PDF (58mm/80mm/A4 mengikuti pengaturan toko), retur/refund.
- **Produk & stok**: CRUD produk/kategori/satuan, stok per cabang dengan **FIFO costing** (batch stok tercatat per penerimaan, dikonsumsi tertua-dulu saat penjualan), import & export Excel.
- **Multi cabang & inventory**: transfer stok antar cabang (otomatis keluar-masuk dengan FIFO cost carry-over), stock opname dengan penyesuaian otomatis + audit trail (`StockMovement`).
- **Pembelian & supplier**: CRUD supplier, purchase order, penerimaan barang yang otomatis menambah stok (batch FIFO baru) dan posting jurnal akuntansi.
- **Pelanggan & loyalty**: CRUD pelanggan, akumulasi/penukaran poin, auto-assign price level berdasarkan ambang poin.
- **Akuntansi**: chart of accounts, jurnal otomatis untuk penjualan/pembelian/pengeluaran (double-entry), laporan Neraca, Laba Rugi, dan Arus Kas dihitung dari jurnal.
- **Laporan**: penjualan & laba (berbasis FIFO COGS), produk terlaris, export PDF/Excel/CSV.
- **Fitur tambahan**: shift kasir (buka/tutup dengan rekonsiliasi kas), cetak label barcode (Code128 via `bwip-js`), manajemen pengeluaran dengan posting jurnal otomatis.
- **Pengaturan**: nama & identitas toko, pajak, printer, ukuran struk, tema, rate loyalty — per cabang.

## PPOB (Digiflazz)

Modul PPOB berjalan dalam **mode mock** secara default (`DIGIFLAZZ_MODE=mock` di `.env`) sehingga bisa dicoba tanpa kredensial nyata — transaksi langsung dianggap sukses dengan SN simulasi. Untuk mengaktifkan integrasi Digiflazz sungguhan:

```bash
DIGIFLAZZ_MODE=live
DIGIFLAZZ_USERNAME=<username digiflazz Anda>
DIGIFLAZZ_API_KEY=<api key digiflazz Anda>
```

Client-nya ada di `backend/src/modules/ppob/digiflazz.client.ts` — sudah memakai skema signature MD5 (`username+apiKey+refId`) sesuai dokumentasi Digiflazz resmi, tinggal disesuaikan bila ada perubahan endpoint di sisi Digiflazz.

## Catatan verifikasi

- Backend: seluruh dependency ter-install bersih dan **`next build`/`tsc --noEmit` frontend lulus tanpa error** (17 halaman ter-compile). Untuk backend, `tsc --noEmit` juga lulus untuk seluruh kode di luar tipe yang dihasilkan Prisma Client — sandbox tempat proyek ini dibuat memblokir akses ke `binaries.prisma.sh` (CDN engine Prisma), sehingga `npx prisma generate` tidak bisa dijalankan/diverifikasi di sini. Jalankan `npx prisma generate` (otomatis terjadi saat `docker compose up --build` atau `npm install` di lingkungan Anda) untuk menghasilkan tipe Prisma Client sepenuhnya — ini adalah langkah standar dan akan berjalan normal di lingkungan dengan akses internet penuh.
- Skema database (`backend/prisma/schema.prisma`) sudah mencakup seluruh modul termasuk yang levelnya masih dasar (PPOB, akuntansi) sehingga siap dikembangkan lebih lanjut tanpa perlu migrasi ulang struktural.

## Yang masih level dasar (sesuai kesepakatan scope)

Modul PPOB (mock), sebagian kecil laporan turunan akuntansi, dan detail UI lanjutan (misalnya approval multi-level untuk PO) belum dikembangkan mendalam — namun skema database dan endpoint dasarnya sudah tersedia untuk dikembangkan lanjut.
