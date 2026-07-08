/**
 * Product Master.xlsx Import Script
 *
 * Column mapping:
 * [0] Main Group   → Brand (auto-created)
 * [1] Item Code    → Product SKU (first row per item code = main product)
 * [2] Bar Code     → Barcode / Variant barcode
 * [3] Item Name    → Product Name
 * [4] Short Name   → (ignored)
 * [5] Base Unit    → Unit (auto-created)
 * [6] P-Rate       → Purchase Price
 * [7] C-Rate       → (cost rate, ignored - using P-Rate)
 * [8] W-S Rate     → Wholesale Price
 * [9] Selling Rate → Selling Price
 * [10] Labeled MRP → (ignored)
 * [11] VAT         → Tax Rate (Non-Taxable=0, Taxable=13)
 * [12] Category    → Category (auto-created)
 * [13] Last Purchased Date → (ignored)
 * [14] Last Purchased Vendor → (ignored)
 * [15] PTYPENAME   → (ignored)
 *
 * Logic:
 * - Group all rows by Item Code
 * - First row per item code = main product (use first barcode as product barcode)
 * - Additional barcodes = product variants with same name + barcode suffix
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────

const toFloat = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const taxRate = (vatStr) => {
  if (!vatStr) return 0;
  if (vatStr.toLowerCase().includes('non')) return 0;
  return 13; // Taxable = 13%
};

// Cache maps so we only hit the DB once per unique name
const unitCache = new Map();
const categoryCache = new Map();
const brandCache = new Map();

async function getOrCreateUnit(name) {
  if (!name) name = 'Pcs.';
  if (unitCache.has(name)) return unitCache.get(name);

  let unit = await prisma.unit.findFirst({ where: { name } });
  if (!unit) {
    const shortNames = { 'Pcs.': 'pcs', 'Pair': 'pr', 'Bottle': 'btl', 'Pkt.': 'pkt', 'Each': 'ea' };
    unit = await prisma.unit.create({
      data: { name, shortName: shortNames[name] || name.substring(0, 4).toLowerCase() },
    });
  }
  unitCache.set(name, unit.id);
  return unit.id;
}

async function getOrCreateCategory(name) {
  const key = name || 'General';
  if (categoryCache.has(key)) return categoryCache.get(key);

  let cat = await prisma.category.findFirst({ where: { name: key, deletedAt: null } });
  if (!cat) {
    cat = await prisma.category.create({ data: { name: key } });
  }
  categoryCache.set(key, cat.id);
  return cat.id;
}

async function getOrCreateBrand(name) {
  const key = name || 'General';
  if (brandCache.has(key)) return brandCache.get(key);

  let brand = await prisma.brand.findFirst({ where: { name: key, deletedAt: null } });
  if (!brand) {
    brand = await prisma.brand.create({ data: { name: key } });
  }
  brandCache.set(key, brand.id);
  return brand.id;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📂 Reading Product Master.xlsx...');
  const wb = xlsx.readFile('Product Master.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  // Remove header row
  const dataRows = rows.slice(1).filter((r) => r[1] && r[3]); // must have item code + name
  console.log(`📊 Total data rows: ${dataRows.length}`);

  // Group by Item Code
  const grouped = new Map();
  for (const row of dataRows) {
    const itemCode = String(row[1]).trim();
    if (!grouped.has(itemCode)) grouped.set(itemCode, []);
    grouped.get(itemCode).push(row);
  }
  console.log(`🗂  Unique products (by Item Code): ${grouped.size}`);

  // Stats
  let created = 0;
  let skipped = 0;
  let variantsCreated = 0;
  let errors = 0;

  const total = grouped.size;
  let processed = 0;

  for (const [itemCode, itemRows] of grouped) {
    processed++;
    if (processed % 500 === 0) {
      console.log(`⏳ Progress: ${processed}/${total} (${Math.round(processed/total*100)}%) | Created: ${created} | Variants: ${variantsCreated}`);
    }

    try {
      const firstRow = itemRows[0];

      const mainGroupName = firstRow[0] ? String(firstRow[0]).trim() : 'General';
      const itemName     = String(firstRow[3]).trim();
      const unitName     = firstRow[5] ? String(firstRow[5]).trim() : 'Pcs.';
      const purchasePrice = toFloat(firstRow[6]);
      const wsRate        = toFloat(firstRow[8]);
      const sellingPrice  = toFloat(firstRow[9]);
      const vatStr        = firstRow[11] ? String(firstRow[11]).trim() : '';
      const categoryName  = firstRow[12] && firstRow[12] !== 'N/A'
                              ? String(firstRow[12]).trim()
                              : mainGroupName;

      // Get/create unit, category, brand
      const unitId     = await getOrCreateUnit(unitName);
      const categoryId = await getOrCreateCategory(categoryName);
      const brandId    = await getOrCreateBrand(mainGroupName);
      const tax        = taxRate(vatStr);

      // Collect unique barcodes (filter nulls and the item code itself used as placeholder)
      const barcodes = itemRows
        .map((r) => r[2] ? String(r[2]).trim() : null)
        .filter((b) => b && b !== itemCode);

      const firstBarcode = barcodes.length > 0 ? barcodes[0] : null;

      // Check if product already exists
      const existingProduct = await prisma.product.findFirst({
        where: { sku: itemCode, deletedAt: null },
      });

      if (existingProduct) {
        skipped++;
        continue;
      }

      // Check if barcode is unique (might already be used)
      let safeBarcode = firstBarcode;
      if (safeBarcode) {
        const barcodeExists = await prisma.product.findFirst({
          where: { barcode: safeBarcode },
        });
        if (barcodeExists) safeBarcode = null;
      }

      // Create the main product
      const product = await prisma.product.create({
        data: {
          name: itemName,
          sku: itemCode,
          barcode: safeBarcode,
          categoryId,
          brandId,
          unitId,
          purchasePrice,
          sellingPrice,
          wholesalePrice: wsRate > 0 ? wsRate : null,
          taxRate: tax,
          minimumStock: 5,
          currentStock: 0,
          status: 'active',
        },
      });
      created++;

      // Create variants for additional barcodes (skip first one used on main product)
      const additionalBarcodes = barcodes.slice(safeBarcode ? 1 : 0);
      for (let i = 0; i < additionalBarcodes.length; i++) {
        const barcode = additionalBarcodes[i];
        if (!barcode) continue;

        // Check barcode uniqueness for variants too
        const varBarcodeExists = await prisma.productVariant.findFirst({
          where: { barcode },
        });
        if (varBarcodeExists) continue;

        const variantSku = `${itemCode}-V${i + 2}`;
        const variantSkuExists = await prisma.productVariant.findFirst({
          where: { sku: variantSku },
        });
        if (variantSkuExists) continue;

        await prisma.productVariant.create({
          data: {
            productId: product.id,
            name: `${itemName} - Variant ${i + 2}`,
            sku: variantSku,
            barcode,
            purchasePrice,
            sellingPrice,
            wholesalePrice: wsRate > 0 ? wsRate : null,
            currentStock: 0,
            attributes: JSON.stringify({ barcode }),
          },
        });
        variantsCreated++;
      }
    } catch (err) {
      errors++;
      if (errors <= 10) {
        console.error(`❌ Error on item ${itemCode}:`, err.message);
      }
    }
  }

  console.log('\n✅ Import Complete!');
  console.log('─'.repeat(40));
  console.log(`✔  Products created  : ${created}`);
  console.log(`⊘  Products skipped  : ${skipped} (already existed)`);
  console.log(`⊕  Variants created  : ${variantsCreated}`);
  console.log(`✖  Errors            : ${errors}`);
  console.log(`📦 Units created     : ${unitCache.size}`);
  console.log(`🏷  Categories created: ${categoryCache.size}`);
  console.log(`🏭 Brands created    : ${brandCache.size}`);
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
