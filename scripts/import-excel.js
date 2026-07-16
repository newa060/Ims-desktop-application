/**
 * Product Master Excel → Supabase Import Script (Flat Variant Mode)
 * 
 * Prerequisites: Run scripts/migration.sql in Supabase SQL Editor first.
 * Run: node scripts/import-excel.js
 */
'use strict';

require('dotenv').config();
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID }   = require('crypto');

// ─── Config ──────────────────────────────────────────────────────────────────
const EXCEL_FILE     = path.join(__dirname, '..', 'Product_Master_Merged.xlsx');
const BATCH_SIZE     = 200;
const STATUS_DEFAULT = 'Draft'; // imported products are inactive by default

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://inshfzdvglzwjybtpcal.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imluc2hmemR2Z2x6d2p5YnRwY2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUyMDQ3MSwiZXhwIjoyMDk5MDk2NDcxfQ.BweL0T9TzC6stNcoGu2WT0HfrIVogeSWhc1tYtHk0qY',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toFloat = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};
const toStr = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const toTax = (v) => {
  if (!v) return 0;
  const s = String(v).toLowerCase();
  if (s.includes('non')) return 0;
  if (s.includes('taxable')) return 13;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const slugify = (t) =>
  (t || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const log = (m) => console.log(m);

// ─── Lookup caches ────────────────────────────────────────────────────────────
const catCache   = new Map();
const unitCache  = new Map();
const SHORT = {
  'Pcs.': 'pcs', 'Pair': 'pr', 'Bottle': 'btl', 'Pkt.': 'pkt',
  'Each': 'ea', 'Set': 'set', 'Box': 'box', 'Kg': 'kg',
  'Gm': 'gm', 'Ltr': 'ltr', 'Mtr': 'mtr', 'Roll': 'roll',
};

async function ensureCat(name) {
  const k = name || 'General';
  if (catCache.has(k)) return k;
  const { data } = await supabase.from('categories').select('id').eq('name', k).maybeSingle();
  if (!data) await supabase.from('categories').insert({ name: k });
  catCache.set(k, k);
  return k;
}

async function ensureUnit(name) {
  const k = name || 'Pcs.';
  if (unitCache.has(k)) return unitCache.get(k);
  const sn = SHORT[k] || k.substring(0, 4).toLowerCase();
  const { data } = await supabase.from('units').select('id,name').eq('name', k).maybeSingle();
  if (!data) await supabase.from('units').insert({ name: k, shortName: sn });
  const e = { name: k, shortName: sn };
  unitCache.set(k, e);
  return e;
}

// ─── Schema check ─────────────────────────────────────────────────────────────
async function checkSchema() {
  log('\n🔍 Checking schema...');
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error && error.code !== 'PGRST116') {
    log(`   Warning: ${error.message}`);
    return { hasHsCode: false, hasSubGroups: false };
  }
  const cols = new Set(data && data.length > 0 ? Object.keys(data[0]) : []);
  const hasHsCode    = cols.has('hs_code');
  const hasSubGroups = cols.has('sub_group_a') && cols.has('sub_group_b') && cols.has('sub_group_c');
  log(`   hs_code column: ${hasHsCode ? '✓ exists' : '✗ MISSING — run scripts/migration.sql first!'}`);
  log(`   sub_group_* columns: ${hasSubGroups ? '✓ exist' : '✗ MISSING — run scripts/migration.sql first!'}`);
  return { hasHsCode, hasSubGroups };
}

// ─── Delete existing data (respecting FK order) ───────────────────────────────
async function deleteExistingData() {
  log('\n🗑  Clearing existing data (FK-safe order)...');

  const steps = [
    { table: 'sale_items',      col: 'id',         msg: 'sale line items' },
    { table: 'purchase_items',  col: 'id',         msg: 'purchase line items' },
    { table: 'inventory_history', col: 'id',       msg: 'inventory history' },
    { table: 'stock_adjustments', col: 'id',       msg: 'stock adjustments' },
    { table: 'sales',           col: 'id',         msg: 'sales records' },
    { table: 'purchases',       col: 'id',         msg: 'purchase records' },
    { table: 'products',        col: 'id',         msg: 'products' },
    { table: 'brands',          col: 'id',         msg: 'brands' },
    { table: 'categories',      col: 'id',         msg: 'categories' },
    { table: 'units',           col: 'id',         msg: 'units' },
  ];

  for (const step of steps) {
    process.stdout.write(`   Deleting ${step.msg}...`);
    const { error } = await supabase
      .from(step.table)
      .delete()
      .neq(step.col, '00000000-0000-0000-0000-000000000000');
    if (error) {
      if (error.code === '42P01') {
        process.stdout.write(` table not found (skipped)\n`);
      } else {
        process.stdout.write(` ⚠ ${error.message}\n`);
      }
    } else {
      process.stdout.write(' ✓\n');
    }
  }
}

// ─── Build product record from row ───────────────────────────────────────────
async function buildRecord(row, sku, schema) {
  const subGroupA    = toStr(row[1]);
  const subGroupB    = toStr(row[2]);
  const subGroupC    = toStr(row[3]);
  const itemCode     = toStr(row[4]);
  const barCode      = toStr(row[5]);
  const itemName     = toStr(row[6]) || 'Unknown';
  const unitName     = toStr(row[8]) || 'Pcs.';
  const rawCat       = toStr(row[17]);
  const mainGroup    = toStr(row[0]) || 'General';
  const catName      = (rawCat && rawCat !== 'N/A') ? rawCat : mainGroup;
  const hsCode       = toStr(row[21]);
  const colorVal     = toStr(row[22]);
  const sizeVal      = toStr(row[23]);

  // Brand column in product table should be empty, and brand table should be empty.
  const brandValue = null; 

  const cat  = await ensureCat(catName);
  const unit = await ensureUnit(unitName);

  // The product name should be exactly the same as the Item Name column from the Excel file (no color/size details appended)
  const displayName = itemName.trim();

  const slug = slugify(`${displayName}-${sku}`);

  const record = {
    id:             randomUUID(),
    name:           displayName,
    slug,
    sku,
    barcode:        barCode || null,
    category:       cat,
    brand:          brandValue,
    unit:           unit.name,
    price:          toFloat(row[14]),
    purchase_price: toFloat(row[11]),
    wholesale_price: toFloat(row[13]) || null,
    tax_rate:       toTax(row[16]),
    minimum_stock:  0,
    stock:          0,
    status:         STATUS_DEFAULT,
    image:          '',
    images:         [],
    description:    '',   // Description should be empty
    sizes:          sizeVal ? [sizeVal] : ['OS'],
    colors:         colorVal ? [colorVal] : [],
    series:         '',   // Series should be empty
  };

  if (schema.hasHsCode)    record.hs_code    = hsCode;
  if (schema.hasSubGroups) {
    record.sub_group_a = subGroupA;
    record.sub_group_b = subGroupB;
    record.sub_group_c = subGroupC;
  }

  return record;
}

// ─── Batch upsert ─────────────────────────────────────────────────────────────
async function batchUpsert(records) {
  let imported = 0;
  const errors = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'sku', ignoreDuplicates: false });

    if (error) {
      console.warn(`\n  ⚠ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message} — retrying row-by-row`);
      for (const row of batch) {
        const { error: re } = await supabase
          .from('products')
          .upsert(row, { onConflict: 'sku', ignoreDuplicates: false });
        if (re) errors.push({ sku: row.sku, error: re.message });
        else imported++;
      }
    } else {
      imported += batch.length;
    }

    const pct = Math.round(((i + batch.length) / records.length) * 100);
    process.stdout.write(`\r  ⏳ ${imported}/${records.length} (${pct}%)...`);
  }

  process.stdout.write('\n');
  return { imported, errors };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();

  log('═'.repeat(60));
  log('  PRODUCT MASTER EXCEL → SUPABASE IMPORT (FLAT VARIANTS V3)');
  log('═'.repeat(60));

  // 1. Schema check
  const schema = await checkSchema();

  // 2. Read Excel
  log(`\n📂 Reading: ${EXCEL_FILE}`);
  const wb = xlsx.readFile(EXCEL_FILE, { cellDates: true });
  const wsName = wb.SheetNames.includes('Products') ? 'Products' : wb.SheetNames[0];
  log(`   Sheet: "${wsName}"`);
  const ws = wb.Sheets[wsName];
  const allRows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  const header   = allRows[0];
  const dataRows = allRows.slice(1).filter(r => r.some(c => c !== null && c !== undefined && c !== ''));
  log(`   Total rows in sheet: ${dataRows.length}`);

  // 3. Clear existing data
  await deleteExistingData();

  // 4. Build records (One for each non-empty Excel row)
  log(`\n🔨 Building product records for all ${dataRows.length} variant rows...`);
  const records = [];
  const buildErrs = [];
  const itemCodeCounts = new Map(); // itemCode -> count of items processed
  const seenSkus = new Set();
  const seenBarcodes = new Set();
  const seenSlugs = new Map();

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const itemCode = toStr(row[4]);
    const itemName = toStr(row[6]);
    if (!itemCode || !itemName) continue; // skip rows missing key info

    try {
      // Sku must use the Item Code from the Excel file.
      // Since itemCode is not unique for variants, we append a suffix starting from the 2nd variant.
      let sku = String(itemCode).trim();
      const currentCount = itemCodeCounts.get(sku) || 0;
      itemCodeCounts.set(sku, currentCount + 1);

      if (currentCount > 0) {
        sku = `${sku}-${currentCount}`;
      }

      const rec = await buildRecord(row, sku, schema);

      // Verify barcode uniqueness
      if (rec.barcode) {
        if (seenBarcodes.has(rec.barcode)) {
          rec.barcode = null; // null duplicate barcode to avoid DB constraint failure
        } else {
          seenBarcodes.add(rec.barcode);
        }
      }

      // Deduplicate slugs
      if (seenSlugs.has(rec.slug)) {
        seenSlugs.set(rec.slug, seenSlugs.get(rec.slug) + 1);
        rec.slug += '-' + seenSlugs.get(rec.slug);
      } else {
        seenSlugs.set(rec.slug, 1);
      }

      records.push(rec);
    } catch (e) {
      buildErrs.push({ line: idx + 2, err: e.message });
      if (buildErrs.length <= 5) console.error(`  ✖ Build error on line ${idx + 2}: ${e.message}`);
    }

    if ((idx + 1) % 2000 === 0) log(`   Processed ${idx + 1}/${dataRows.length} rows...`);
  }
  log(`   ✓ ${records.length} records ready  (${buildErrs.length} build errors)`);

  // 5. Batch upsert
  log(`\n⬆  Importing variants to Supabase (batch=${BATCH_SIZE})...`);
  const { imported, errors: upErrs } = await batchUpsert(records);

  // 6. Summary
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const failed  = buildErrs.length + upErrs.length;

  log('\n' + '═'.repeat(60));
  log('  IMPORT SUMMARY (FLAT VARIANTS V3)');
  log('═'.repeat(60));
  log(`  📊 Total Excel rows      : ${dataRows.length}`);
  log(`  ✔  Imported successfully : ${imported}`);
  log(`  ✖  Failed                : ${failed}`);
  log(`  🏷  Categories ensured    : ${catCache.size}`);
  log(`  📐 Units ensured         : ${unitCache.size}`);
  log(`  🆕 New cols (hs_code etc): ${schema.hasHsCode && schema.hasSubGroups ? 'used' : 'NOT available — run migration.sql'}`);
  log(`  ⏱  Duration              : ${elapsed}s`);
  log('═'.repeat(60));

  if (upErrs.length > 0) {
    log('\n❌ Upsert errors:');
    upErrs.slice(0, 20).forEach(e => log(`  SKU: ${e.sku} | ${e.error}`));
    if (upErrs.length > 20) log(`  ...and ${upErrs.length - 20} more`);
  }

  log(failed === 0
    ? '\n✅ Import completed with ZERO errors!'
    : `\n⚠  Import completed with ${failed} error(s). Review above.`
  );
}

main().catch(e => {
  console.error('Fatal:', e.message, e);
  process.exit(1);
});
