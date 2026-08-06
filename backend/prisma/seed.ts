import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS = {
  SUPER_ADMIN: ["*"],
  OWNER: ["*"],
  BRANCH_MANAGER: [
    "branch.view",
    "product.view",
    "product.manage",
    "stock.view",
    "stock.transfer",
    "stock.opname",
    "pos.sell",
    "pos.view",
    "pos.refund",
    "purchasing.view",
    "purchasing.manage",
    "purchasing.approve",
    "purchasing.receive",
    "customer.view",
    "customer.manage",
    "accounting.view",
    "report.view",
    "ppob.view",
    "ppob.manage",
    "ppob.transact",
    "settings.view",
    "settings.manage",
    "shift.manage",
    "expense.view",
    "expense.manage",
  ],
  CASHIER: [
    "product.view",
    "stock.view",
    "pos.sell",
    "pos.view",
    "pos.refund",
    "customer.view",
    "customer.manage",
    "shift.manage",
    "ppob.view",
    "ppob.transact",
    "settings.view",
    "report.view",
  ],
  WAREHOUSE: [
    "branch.view",
    "product.view",
    "product.manage",
    "stock.view",
    "stock.transfer",
    "stock.opname",
    "purchasing.view",
    "purchasing.manage",
    "purchasing.receive",
  ],
  ACCOUNTANT: [
    "branch.view",
    "accounting.view",
    "accounting.manage",
    "report.view",
    "expense.view",
    "expense.manage",
    "settings.view",
  ],
} as const;

async function main() {
  console.log("Seeding bpos database...");

  // Roles
  const roles: Record<string, { id: string }> = {};
  for (const [name, permissions] of Object.entries(PERMISSIONS)) {
    roles[name] = await prisma.role.upsert({
      where: { name: name as any },
      update: { permissions },
      create: { name: name as any, permissions, description: `${name} role` },
    });
  }

  // Branches
  const mainBranch = await prisma.branch.upsert({
    where: { code: "BR-001" },
    update: {},
    create: { code: "BR-001", name: "Cabang Pusat", address: "Jl. Sudirman No. 1, Jakarta", phone: "021-1234567" },
  });
  const branch2 = await prisma.branch.upsert({
    where: { code: "BR-002" },
    update: {},
    create: { code: "BR-002", name: "Cabang Bandung", address: "Jl. Asia Afrika No. 10, Bandung", phone: "022-7654321" },
  });

  // Users
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@bpos.local" },
    update: { passwordHash, roleId: roles.SUPER_ADMIN.id },
    create: { name: "Super Admin", email: "admin@bpos.local", passwordHash, roleId: roles.SUPER_ADMIN.id },
  });
  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: admin.id, branchId: mainBranch.id } },
    update: {},
    create: { userId: admin.id, branchId: mainBranch.id, isDefault: true },
  });
  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: admin.id, branchId: branch2.id } },
    update: {},
    create: { userId: admin.id, branchId: branch2.id },
  });

  const cashier = await prisma.user.upsert({
    where: { email: "kasir@bpos.local" },
    update: { passwordHash, roleId: roles.CASHIER.id },
    create: { name: "Kasir Toko", email: "kasir@bpos.local", passwordHash, roleId: roles.CASHIER.id },
  });
  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: cashier.id, branchId: mainBranch.id } },
    update: {},
    create: { userId: cashier.id, branchId: mainBranch.id, isDefault: true },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@bpos.local" },
    update: { passwordHash, roleId: roles.BRANCH_MANAGER.id },
    create: { name: "Manajer Cabang", email: "manager@bpos.local", passwordHash, roleId: roles.BRANCH_MANAGER.id },
  });
  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: manager.id, branchId: mainBranch.id } },
    update: {},
    create: { userId: manager.id, branchId: mainBranch.id, isDefault: true },
  });

  // Chart of accounts
  const accounts = [
    { code: "1000", name: "Kas", type: "ASSET" },
    { code: "1010", name: "Bank", type: "ASSET" },
    { code: "1100", name: "Piutang Usaha", type: "ASSET" },
    { code: "1200", name: "Persediaan Barang", type: "ASSET" },
    { code: "2000", name: "Hutang Usaha", type: "LIABILITY" },
    { code: "2100", name: "Hutang Pajak (PPN)", type: "LIABILITY" },
    { code: "3000", name: "Modal Pemilik", type: "EQUITY" },
    { code: "4000", name: "Pendapatan Penjualan", type: "REVENUE" },
    { code: "4100", name: "Pendapatan Lain-lain", type: "REVENUE" },
    { code: "5000", name: "Harga Pokok Penjualan", type: "EXPENSE" },
    { code: "5100", name: "Beban Operasional", type: "EXPENSE" },
  ] as const;
  for (const acc of accounts) {
    await prisma.account.upsert({ where: { code: acc.code }, update: {}, create: acc as any });
  }

  // Units & categories
  const pcs = await prisma.unit.upsert({ where: { name: "Pcs" }, update: {}, create: { name: "Pcs", symbol: "pcs" } });
  const box = await prisma.unit.upsert({ where: { name: "Box" }, update: {}, create: { name: "Box", symbol: "box" } });

  const catMakanan = await prisma.category.create({ data: { name: "Makanan & Minuman" } }).catch(async () =>
    prisma.category.findFirstOrThrow({ where: { name: "Makanan & Minuman" } })
  );
  const catAlat = await prisma.category.create({ data: { name: "Alat Tulis" } }).catch(async () =>
    prisma.category.findFirstOrThrow({ where: { name: "Alat Tulis" } })
  );

  // Price levels
  const retail = await prisma.priceLevel.upsert({ where: { name: "Retail" }, update: {}, create: { name: "Retail", minPoints: 0 } });
  await prisma.priceLevel.upsert({ where: { name: "Member Silver" }, update: {}, create: { name: "Member Silver", minPoints: 100 } });
  await prisma.priceLevel.upsert({ where: { name: "Member Gold" }, update: {}, create: { name: "Member Gold", minPoints: 500 } });

  // Sample products with initial stock at main branch
  const sampleProducts = [
    { sku: "SKU-001", barcode: "8991234500011", name: "Air Mineral 600ml", categoryId: catMakanan.id, unitId: pcs.id, costPrice: 2500, sellPrice: 4000, qty: 200 },
    { sku: "SKU-002", barcode: "8991234500028", name: "Kopi Sachet 20g", categoryId: catMakanan.id, unitId: pcs.id, costPrice: 1200, sellPrice: 2000, qty: 300 },
    { sku: "SKU-003", barcode: "8991234500035", name: "Buku Tulis 38 Lembar", categoryId: catAlat.id, unitId: pcs.id, costPrice: 3000, sellPrice: 5000, qty: 150 },
    { sku: "SKU-004", barcode: "8991234500042", name: "Pulpen Standar", categoryId: catAlat.id, unitId: pcs.id, costPrice: 1500, sellPrice: 2500, qty: 250 },
  ];

  for (const p of sampleProducts) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        categoryId: p.categoryId,
        unitId: p.unitId,
        costPrice: p.costPrice,
        sellPrice: p.sellPrice,
        isTaxable: true,
        taxRate: 11,
      },
    });

    const existingStock = await prisma.productStock.findUnique({
      where: { productId_branchId: { productId: product.id, branchId: mainBranch.id } },
    });
    if (!existingStock) {
      await prisma.stockBatch.create({
        data: { productId: product.id, branchId: mainBranch.id, qtyRemaining: p.qty, qtyOriginal: p.qty, unitCost: p.costPrice, sourceType: "INITIAL" },
      });
      await prisma.productStock.create({ data: { productId: product.id, branchId: mainBranch.id, qty: p.qty } });
      await prisma.stockMovement.create({
        data: { productId: product.id, branchId: mainBranch.id, type: "INITIAL", qty: p.qty, unitCost: p.costPrice, refType: "Seed" },
      });
    }
  }

  // Expense categories
  for (const name of ["Listrik & Air", "Sewa Tempat", "Gaji Karyawan", "Perlengkapan Toko"]) {
    await prisma.expenseCategory.upsert({ where: { name }, update: {}, create: { name } });
  }

  // PPOB sample catalog (mock)
  const ppobProducts = [
    { buyerSkuCode: "PLN20", productName: "Token PLN 20.000", category: "PLN", price: 21500 },
    { buyerSkuCode: "PLN50", productName: "Token PLN 50.000", category: "PLN", price: 51500 },
    { buyerSkuCode: "TSEL10", productName: "Pulsa Telkomsel 10.000", category: "Pulsa", brand: "Telkomsel", price: 11000 },
    { buyerSkuCode: "BPJS1", productName: "BPJS Kesehatan 1 Bulan", category: "BPJS", price: 150000 },
  ];
  for (const p of ppobProducts) {
    await prisma.ppobProduct.upsert({ where: { buyerSkuCode: p.buyerSkuCode }, update: {}, create: p as any });
  }

  // Store settings
  await prisma.storeSetting.upsert({
    where: { branchId: mainBranch.id },
    update: {},
    create: { branchId: mainBranch.id, storeName: "BPOS Demo Store", taxRate: 11, receiptSize: "58mm" },
  });

  console.log("Seed complete.");
  console.log("Login accounts (password: password123):");
  console.log("  admin@bpos.local     -> Super Admin (semua cabang)");
  console.log("  manager@bpos.local   -> Branch Manager (Cabang Pusat)");
  console.log("  kasir@bpos.local     -> Cashier (Cabang Pusat)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
