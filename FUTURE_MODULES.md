# Rencana Modul Masa Depan BPOS

Dokumen ini adalah backlog untuk memilih pengembangan berikutnya. Isinya rekomendasi berdasarkan struktur kode dan dokumentasi yang ada saat ini, bukan komitmen bahwa semua modul harus dibuat.

## Gambaran aplikasi saat ini

BPOS adalah aplikasi POS dan operasional multi-cabang. Frontend memakai Next.js, backend Express/TypeScript dengan Prisma, PostgreSQL, dan Redis. Modul yang sudah tersedia mencakup login dan hak akses per cabang, POS, produk, stok FIFO, transfer dan opname, pembelian dengan approval PO satu tingkat, pelanggan dan loyalty, shift kasir, pengeluaran, laporan penjualan, akuntansi double-entry, pengaturan, serta PPOB.

Bagian yang sudah ada dan sebaiknya dimanfaatkan sebelum membuat modul baru:

- `Product.minStock` dan laporan penjualan bisa menjadi dasar saran pembelian otomatis.
- `PurchaseOrder`, `GoodsReceipt`, dan jurnal pembelian sudah membentuk alur pembelian awal.
- `SalePayment` sudah mencatat metode dan nominal pembayaran transaksi.
- `StockBatch` menyimpan FIFO cost, tetapi belum menyimpan tanggal kedaluwarsa atau nomor lot.
- `Account`, `JournalEntry`, dan laporan akuntansi sudah menjadi dasar pencatatan kas/bank dan rekonsiliasi.
- PPOB sudah memiliki alur mock dan callback; koneksi live tetap menunggu kredensial dan uji operasional provider.

## Cara membaca prioritas

| Penanda | Arti |
|---|---|
| P1 | Paling masuk akal dievaluasi/dikerjakan lebih dulu karena menutup celah operasional yang dekat dengan fitur saat ini. |
| P2 | Berguna setelah kebutuhan pengguna terkonfirmasi atau fondasi P1 siap. |
| P3 | Investasi besar atau sangat bergantung pada jenis bisnis; jangan mulai tanpa bukti kebutuhan. |

Ukuran: **S** sekitar 1–2 minggu-orang, **M** 3–5 minggu-orang, **L** 6+ minggu-orang. Ini perkiraan kasar untuk satu developer yang sudah memahami repo; desain, migrasi data, integrasi pihak ketiga, dan uji lapangan dapat menambah waktu.

Status keputusan tiap opsi sengaja dikosongkan agar bisa ditandai **Kerjakan / Tunda / Tidak perlu**.

## Opsi modul

| Pilih | Prioritas | Modul | Nilai yang diberikan | Kelayakan | Ukuran |
|---|---|---|---|---|---|
| ☐ | P1 | Hutang supplier dan pembayaran pembelian | Mengetahui tagihan yang belum lunas, jatuh tempo, pembayaran sebagian, dan saldo per supplier. Saat ini penerimaan barang dan jurnal pembelian sudah ada, tetapi belum ada entitas tagihan/pembayaran supplier yang terlihat di skema. | **Tinggi.** Lanjutan alami dari PO → penerimaan barang; perlu keputusan apakah pembayaran dicatat per tagihan atau langsung per penerimaan. | M |
| ☐ | P1 | Pencatatan pajak masukan dan laporan pajak lengkap | Memisahkan pajak pembelian dari biaya/stok dan menampilkan pajak masukan serta keluaran dengan jejak jurnal yang dapat diperiksa. Dokumentasi proyek menyebut PPN masukan masih dilaporkan nol karena belum dipisahkan. | **Tinggi**, jika bisnis memang perlu pembukuan PPN. Perlu aturan pajak dan format laporan yang disepakati dengan akuntan. | M |
| ☐ | P1 | Rekonsiliasi bank dan QRIS | Mencocokkan transaksi Transfer/QRIS dengan mutasi rekening/provider, menandai selisih, dan membantu penutupan kas yang lebih akurat. Belum ada model mutasi rekening atau proses matching. | **Menengah.** Bisa dimulai dari impor CSV manual; sinkronisasi otomatis tergantung bank/provider dan akses integrasi. | M (CSV), L (otomatis) |
| ☑ | P1 | Saran pembelian / reorder | **Selesai untuk MVP.** Tab Saran Restock menghitung target dari `minStock` atau rata-rata penjualan selesai selama histori yang dipilih, lalu mengurangi stok cabang. Rekomendasi dapat dimasukkan ke draft PO untuk alur persetujuan yang sudah ada. Belum memperhitungkan lead time supplier dan retur parsial. | **Tinggi** karena memanfaatkan data produk, stok, dan penjualan yang sudah ada. Tingkatkan akurasi dengan konfigurasi lead time dan penanganan retur. | S–M |
| ☑ | P1 | Export laporan akuntansi dan filter periode/cabang | **Selesai untuk CSV.** Laba Rugi, Neraca, Arus Kas, Buku Besar, dan Pajak kini dapat difilter berdasarkan tanggal/cabang dan diekspor ke CSV. Export Excel/PDF belum termasuk. | **Tinggi.** Banyak logika laporan tersedia; perlu konsistensi filter periode/cabang dan format file. | S–M |
| ☐ | P1 | Audit log aktivitas pengguna | Mencatat siapa mengubah harga/produk, menyetujui PO, mengubah stok, mengatur user, atau melakukan tindakan sensitif; berguna untuk investigasi kesalahan dan kontrol multi-cabang. Stock movement sudah menjadi audit stok, tetapi belum merupakan audit log umum. | **Tinggi** untuk penggunaan banyak pegawai/cabang. Perlu menentukan event penting, retensi, dan akses baca. | M |
| ☐ | P2 | PPOB live dan rekonsiliasi saldo provider | Mengaktifkan transaksi Digiflazz sungguhan, memeriksa callback, saldo/deposit provider, kegagalan, refund, dan laporan komisi. Jalur mock sudah ada; integrasi live belum tervalidasi dengan kredensial nyata. | **Layak hanya jika PPOB bagian dari model bisnis dan margin cukup.** Memerlukan akun/kredensial, URL callback publik, dan uji bertahap. | M, ditambah waktu uji eksternal |
| ☐ | P2 | Lot dan tanggal kedaluwarsa | Melacak tanggal kedaluwarsa per batch, memberi peringatan stok mendekati kedaluwarsa, serta mendukung FIFO/FEFO sesuai aturan barang. `StockBatch` sekarang untuk biaya FIFO dan belum punya expiry/lot. | **Tinggi untuk bahan makanan, kosmetik, obat, atau barang berumur simpan; rendah untuk toko barang umum.** FEFO mengubah aturan konsumsi stok dan perlu perencanaan migrasi. | M–L |
| ☐ | P2 | Promosi dan kupon | Menangani diskon terjadwal, beli X gratis Y, kupon, batas pemakaian, serta laporan dampak promosi. POS saat ini mendukung diskon per item dan total, belum mesin aturan promosi. | **Menengah.** Perlu aturan yang tidak ambigu untuk gabungan diskon, pajak, retur, dan loyalty. | M |
| ☐ | P2 | CRM dan kampanye pelanggan | Segmentasi pelanggan dari riwayat belanja/loyalty dan pengiriman pesan promosi/pengingat. Data pelanggan dan poin tersedia, tetapi belum ada preferensi komunikasi atau kampanye. | **Menengah.** Segmentasi dasar bisa dibuat internal; pengiriman WhatsApp/SMS memerlukan vendor, biaya, persetujuan pelanggan, dan pengelolaan opt-out. | M (segmentasi), L (pengiriman terintegrasi) |
| ☐ | P2 | Penjualan online / pesanan omnichannel | Mengelola order dari toko online/marketplace, stok bersama, status pemenuhan, dan retur lintas kanal. | **Rendah–menengah untuk sekarang.** Butuh memilih kanal spesifik dahulu; konektor tiap marketplace, sinkronisasi stok, dan penanganan order duplikat menambah beban. | L |
| ☐ | P3 | POS offline-first dan sinkronisasi | Kasir tetap berjualan saat internet putus, lalu menyinkronkan transaksi saat tersambung. | **Sulit dan berisiko tinggi.** Perlu penyimpanan lokal, idempotensi, konflik stok/harga, sinkronisasi aman, serta perangkat dan skenario uji lapangan. Jangan dijadikan prioritas tanpa masalah koneksi nyata. | L |
| ☐ | P3 | Payroll dan absensi | Mengelola data pegawai, jadwal/absensi, komponen gaji, potongan, dan slip gaji. | **Rendah untuk fokus produk saat ini.** Domain berbeda, aturan penggajian bergantung kondisi usaha, dan dapat lebih tepat memakai sistem payroll khusus. | L |
| ☐ | P3 | Produksi / perakitan / resep bahan | Mengubah bahan baku menjadi barang jadi, menghitung biaya produksi, dan mencatat susut. | **Rendah kecuali toko memproduksi atau merakit barang.** Membutuhkan bill of materials/resep dan alur stok produksi yang belum ada. | L |

## Urutan yang disarankan

1. **Validasi kebutuhan operasional**: tanyakan apakah bisnis memakai hutang supplier, wajib mencatat PPN masukan, dan mengalami selisih pembayaran bank/QRIS.
2. Jika hutang supplier dipakai, kerjakan **Hutang supplier dan pembayaran pembelian**. Ini mengisi celah dari pembelian yang sekarang sudah berjalan.
3. Kerjakan **pencatatan pajak masukan** setelah aturan pajak dan akun akuntansi disepakati dengan pihak yang menangani pembukuan.
4. **Saran pembelian** tersedia untuk MVP; berikutnya pilih **rekonsiliasi bank** sesuai masalah harian yang paling sering terjadi.
5. Tambahkan **audit log** sebelum jumlah cabang/pengguna bertambah atau sebelum memberi akses administrasi lebih luas.
6. Ambil opsi P2/P3 hanya jika kondisi bisnis pada kolom kelayakan cocok. PPOB live memerlukan kredensial dan uji provider; expiry cocok untuk barang berumur simpan; POS offline dan marketplace adalah proyek integrasi besar.

## Hal yang perlu diputuskan sebelum setiap modul

- Siapa pengguna utamanya dan masalah yang ingin dipangkas?
- Apakah modul wajib per cabang atau datanya lintas cabang?
- Apakah perlu approval dan permission baru?
- Data apa yang harus bisa diimpor/diekspor, dan siapa sumber kebenarannya?
- Apakah ada vendor, format dokumen, aturan pajak, atau perangkat yang harus dipastikan lebih dulu?
- Kriteria selesai apa yang bisa dicek saat uji operasional?

## Pilihan awal

Modul **Saran pembelian** dan **Export laporan akuntansi** sudah tersedia. Kandidat berikutnya yang relatif masuk akal adalah **Hutang supplier**; jika bisnis mencatat PPN, naikkan **Pencatatan pajak masukan** ke urutan pertama setelah konfirmasi akuntan. Perkiraan dan urutan ini perlu disesuaikan dengan jenis toko, skala cabang, dan kendala harian yang paling terasa.
