import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  { sku: "MM-001", name: "Beras Premium 5 kg", category: "Bahan Pokok", unit: "Pack", cost: 68000, price: 75000, qty: 20 },
  { sku: "MM-002", name: "Gula Pasir 1 kg", category: "Bahan Pokok", unit: "Pack", cost: 15500, price: 18000, qty: 35 },
  { sku: "MM-003", name: "Minyak Goreng 1 L", category: "Bahan Pokok", unit: "Botol", cost: 15500, price: 18000, qty: 30 },
  { sku: "MM-004", name: "Tepung Terigu 1 kg", category: "Bahan Pokok", unit: "Pack", cost: 10500, price: 12500, qty: 25 },
  { sku: "MM-005", name: "Garam Halus 500 g", category: "Bahan Pokok", unit: "Pack", cost: 3500, price: 5000, qty: 30 },
  { sku: "MM-006", name: "Mi Instan Goreng", category: "Makanan & Minuman", unit: "Pcs", cost: 2800, price: 3500, qty: 60 },
  { sku: "MM-007", name: "Mi Instan Kuah Ayam", category: "Makanan & Minuman", unit: "Pcs", cost: 2700, price: 3500, qty: 60 },
  { sku: "MM-008", name: "Roti Tawar", category: "Makanan & Minuman", unit: "Pack", cost: 12000, price: 15000, qty: 15 },
  { sku: "MM-009", name: "Biskuit Cokelat", category: "Makanan Ringan", unit: "Pack", cost: 7500, price: 10000, qty: 25 },
  { sku: "MM-010", name: "Keripik Kentang", category: "Makanan Ringan", unit: "Pack", cost: 9000, price: 12000, qty: 20 },
  { sku: "MM-011", name: "Wafer Cokelat", category: "Makanan Ringan", unit: "Pcs", cost: 4500, price: 6000, qty: 30 },
  { sku: "MM-012", name: "Kacang Panggang", category: "Makanan Ringan", unit: "Pack", cost: 6000, price: 8000, qty: 25 },
  { sku: "MM-013", name: "Air Mineral 1.5 L", category: "Minuman", unit: "Botol", cost: 4000, price: 6000, qty: 36 },
  { sku: "MM-014", name: "Teh Siap Minum 350 ml", category: "Minuman", unit: "Botol", cost: 3500, price: 5000, qty: 36 },
  { sku: "MM-015", name: "Susu UHT 250 ml", category: "Produk Susu", unit: "Kotak", cost: 4500, price: 6000, qty: 24 },
  { sku: "MM-016", name: "Minuman Soda 330 ml", category: "Minuman", unit: "Kaleng", cost: 6000, price: 8500, qty: 24 },
  { sku: "MM-017", name: "Minuman Isotonik 500 ml", category: "Minuman", unit: "Botol", cost: 5500, price: 7500, qty: 24 },
  { sku: "MM-018", name: "Kopi Instan 3-in-1", category: "Minuman", unit: "Sachet", cost: 1500, price: 2500, qty: 50 },
  { sku: "MM-019", name: "Teh Celup Isi 25", category: "Minuman", unit: "Box", cost: 8500, price: 11000, qty: 18 },
  { sku: "MM-020", name: "Sabun Mandi", category: "Perawatan Diri", unit: "Pcs", cost: 3500, price: 5000, qty: 30 },
  { sku: "MM-021", name: "Sampo Sachet", category: "Perawatan Diri", unit: "Sachet", cost: 1000, price: 1500, qty: 50 },
  { sku: "MM-022", name: "Pasta Gigi 120 g", category: "Perawatan Diri", unit: "Pcs", cost: 10500, price: 13500, qty: 20 },
  { sku: "MM-023", name: "Sikat Gigi Dewasa", category: "Perawatan Diri", unit: "Pcs", cost: 6000, price: 8500, qty: 20 },
  { sku: "MM-024", name: "Sabun Cuci Piring 500 ml", category: "Produk Rumah Tangga", unit: "Botol", cost: 8500, price: 11000, qty: 20 },
  { sku: "MM-025", name: "Deterjen Bubuk 800 g", category: "Produk Rumah Tangga", unit: "Pack", cost: 14500, price: 18000, qty: 18 },
  { sku: "MM-026", name: "Pembersih Lantai 800 ml", category: "Produk Rumah Tangga", unit: "Botol", cost: 11500, price: 15000, qty: 15 },
  { sku: "MM-027", name: "Tisu Wajah 250 Lembar", category: "Produk Rumah Tangga", unit: "Pack", cost: 9000, price: 12000, qty: 20 },
  { sku: "MM-028", name: "Baterai AA Isi 2", category: "Produk Rumah Tangga", unit: "Pack", cost: 8000, price: 10500, qty: 18 },
  { sku: "MM-029", name: "Popok Bayi Isi 10", category: "Perawatan Diri", unit: "Pack", cost: 16000, price: 20000, qty: 15 },
  { sku: "MM-030", name: "Cokelat Batang", category: "Makanan Ringan", unit: "Pcs", cost: 6500, price: 9000, qty: 20 },
] as const;

async function main() {
  const branch = await prisma.branch.findUnique({ where: { code: "BR-001" } });
  if (!branch) {
    throw new Error("Cabang BR-001 tidak ditemukan. Jalankan seed utama terlebih dahulu.");
  }

  const categoryNames = [...new Set(products.map((product) => product.category))];
  const categories = new Map<string, string>();
  for (const name of categoryNames) {
    const category = await prisma.category.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    const savedCategory = category ?? (await prisma.category.create({ data: { name } }));
    categories.set(name, savedCategory.id);
  }

  const unitNames = [...new Set(products.map((product) => product.unit))];
  const units = new Map<string, string>();
  for (const name of unitNames) {
    const symbol = name.toLowerCase();
    const unit = await prisma.unit.upsert({
      where: { name },
      update: {},
      create: { name, symbol },
    });
    units.set(name, unit.id);
  }

  let createdCount = 0;
  let stockCount = 0;
  for (const item of products) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { sku: item.sku } });
      const product = await tx.product.upsert({
        where: { sku: item.sku },
        update: {},
        create: {
          sku: item.sku,
          name: item.name,
          categoryId: categories.get(item.category)!,
          unitId: units.get(item.unit)!,
          costPrice: item.cost,
          sellPrice: item.price,
          isTaxable: true,
          taxRate: 11,
          minStock: 5,
        },
      });
      if (!existing) createdCount++;

      const stock = await tx.productStock.findUnique({
        where: { productId_branchId: { productId: product.id, branchId: branch.id } },
      });
      if (!stock) {
        await tx.stockBatch.create({
          data: {
            productId: product.id,
            branchId: branch.id,
            qtyRemaining: item.qty,
            qtyOriginal: item.qty,
            unitCost: item.cost,
            sourceType: "INITIAL",
            sourceRefId: item.sku,
          },
        });
        await tx.productStock.create({
          data: { productId: product.id, branchId: branch.id, qty: item.qty },
        });
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            branchId: branch.id,
            type: "INITIAL",
            qty: item.qty,
            unitCost: item.cost,
            refType: "MinimarketSeed",
            refId: item.sku,
          },
        });
        stockCount++;
      }
    });
  }

  console.log(`Katalog minimarket selesai: ${createdCount} produk baru, ${stockCount} stok awal ditambahkan ke ${branch.name}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
