/**
 * run_rebuild.js
 *
 * Uses the installed @supabase/supabase-js client to rebuild product_variant_flat
 * and re-link all product_variant rows to their correct parent.
 *
 * Run: node scripts/run_rebuild.js
 */

require('dotenv').config();
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ROOT     = path.join(__dirname, '..');
const sleep    = ms => new Promise(r => setTimeout(r, ms));

// ── Helpers ───────────────────────────────────────────────────────────────

function parseCsvLine(line) {
  const res = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { res.push(cur); cur = ''; }
    else cur += ch;
  }
  res.push(cur);
  return res;
}

function slugify(str) {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Load Product_Master.xlsx ───────────────────────────────────────────────

function loadMaster() {
  const wb    = XLSX.readFile(path.join(ROOT, 'Product_Master.xlsx'));
  const ws    = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const byCode = new Map();
  for (const r of rows) {
    const code = parseFloat(r['Item Code']);
    if (!isNaN(code)) byCode.set(code, r);
  }
  console.log(`Master loaded: ${byCode.size} products`);
  return byCode;
}

// ── Load Supabase-producttable.csv ─────────────────────────────────────────

function loadCSV() {
  const text  = fs.readFileSync(path.join(ROOT, 'Supabase-producttable.csv'), 'utf8');
  const lines = text.trim().split('\n');
  const hdrs  = lines[0].split(',');
  const ci    = n => hdrs.indexOf(n);
  const IDX   = { id: ci('id'), sku: ci('sku') };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCsvLine(lines[i]);
    const id   = cols[IDX.id]  || '';
    const sku  = cols[IDX.sku] || '';
    if (!id) continue;
    const code    = parseFloat(sku.replace(/-\d+$/, ''));
    const codeStr = isNaN(code) ? null : String(code);
    rows.push({ id, sku, codeStr });
  }
  console.log(`CSV loaded: ${rows.length} variant rows`);
  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const master = loadMaster();
  const csv    = loadCSV();

  // Build itemCodeStr → variantIds[]
  const parentMap = new Map();
  for (const row of csv) {
    if (!row.codeStr) continue;
    if (!parentMap.has(row.codeStr)) parentMap.set(row.codeStr, []);
    parentMap.get(row.codeStr).push(row.id);
  }
  console.log(`Unique parents: ${parentMap.size}`);

  // ── Step 1: Fetch existing product_flat_id for first variant of each parent
  console.log('\nStep 1: Resolving existing parent IDs...');

  const firstIds    = [...parentMap.values()].map(ids => ids[0]);
  const variantPfid = new Map(); // variant UUID → current product_flat_id

  // Fetch in small batches to avoid URL length issues
  const FETCH_BATCH = 100;
  for (let i = 0; i < firstIds.length; i += FETCH_BATCH) {
    const batch = firstIds.slice(i, i + FETCH_BATCH);
    const { data, error } = await supabase
      .from('product_variant')
      .select('id, product_flat_id')
      .in('id', batch);

    if (error) throw new Error('Fetch variants: ' + error.message);
    for (const r of (data || [])) variantPfid.set(r.id, r.product_flat_id);

    if (i % 1000 === 0)
      process.stdout.write(`  ${Math.min(i + FETCH_BATCH, firstIds.length)}/${firstIds.length}\r`);
    await sleep(30);
  }
  console.log(`  Resolved ${variantPfid.size} parent IDs            `);

  // ── Step 2: Build flat rows and upsert product_variant_flat
  console.log('\nStep 2: Upserting product_variant_flat...');

  const flatRows     = [];
  const codeToFlatId = new Map(); // itemCodeStr → final parent id

  for (const [codeStr, variantIds] of parentMap) {
    const code = parseFloat(codeStr);
    const m    = master.get(code);
    if (!m) continue;

    // Reuse existing product_flat_id so existing FK references survive
    const existingId = variantPfid.get(variantIds[0]);
    const id         = existingId || variantIds[0];

    codeToFlatId.set(codeStr, id);

    const name      = String(m['Item Name']   || '').trim();
    const category  = String(m['Main Group']  || '').trim();
    const brand     = String(m['Sub Group A'] || '').trim() || null;
    const baseUnit  = String(m['Base Unit']   || '').trim() || null;
    const altUnit   = String(m['Alt Unit']    || '').trim() || null;
    const cFactor   = parseFloat(m['C-Factor'])  || null;
    const purchase  = parseFloat(m['P-Rate'])     || 0;
    const selling   = parseFloat(m['Selling Rate'])|| 0;
    const wholesale = parseFloat(m['W-SRate'])     || null;
    const taxRate   = m['VAT'] === 'Non-Taxable'   ? 0 : 13;

    flatRows.push({
      id,
      name,
      slug:            slugify(`${codeStr}-${name}`),
      category,
      brand,
      base_unit:       baseUnit,
      alt_unit:        altUnit,
      c_factor:        cFactor,
      purchase_price:  purchase,
      selling_price:   selling,
      wholesale_price: wholesale,
      tax_rate:        taxRate,
      status:          'Active',
    });
  }

  // Upsert in batches of 100
  const UPSERT_BATCH = 100;
  let done = 0;
  for (let i = 0; i < flatRows.length; i += UPSERT_BATCH) {
    const batch = flatRows.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase
      .from('product_variant_flat')
      .upsert(batch, { onConflict: 'id' });

    if (error) throw new Error(`Upsert flat [${i}]: ${error.message}`);
    done += batch.length;
    process.stdout.write(`  ${done}/${flatRows.length}\r`);
    await sleep(80);
  }
  console.log(`  Upserted ${done} product_variant_flat rows     `);

  // ── Step 3: Re-link product_variant.product_flat_id
  console.log('\nStep 3: Re-linking variants to correct parents...');

  let relinked = 0;
  const UPDATE_BATCH = 100;

  for (const [codeStr, variantIds] of parentMap) {
    const parentId = codeToFlatId.get(codeStr);
    if (!parentId) continue;

    for (let i = 0; i < variantIds.length; i += UPDATE_BATCH) {
      const batch = variantIds.slice(i, i + UPDATE_BATCH);
      const { error } = await supabase
        .from('product_variant')
        .update({ product_flat_id: parentId })
        .in('id', batch);

      if (error) throw new Error(`Update variants [${codeStr}]: ${error.message}`);
      relinked += batch.length;
    }
    await sleep(20);
  }
  process.stdout.write(`  ${relinked}/${csv.length} re-linked             \r`);
  console.log(`\n  Re-linked ${relinked} variants`);

  // ── Step 4: Archive orphaned product_variant_flat rows
  console.log('\nStep 4: Archiving orphaned flat rows...');

  const activeIds = new Set(flatRows.map(r => r.id));

  // Fetch all non-archived flat rows
  const { data: allFlat, error: flatErr } = await supabase
    .from('product_variant_flat')
    .select('id')
    .neq('status', 'Archived');

  if (flatErr) throw new Error('Fetch flat: ' + flatErr.message);

  const orphanIds = (allFlat || [])
    .map(r => r.id)
    .filter(id => !activeIds.has(id));

  if (orphanIds.length > 0) {
    for (let i = 0; i < orphanIds.length; i += UPDATE_BATCH) {
      const batch = orphanIds.slice(i, i + UPDATE_BATCH);
      await supabase
        .from('product_variant_flat')
        .update({ status: 'Archived' })
        .in('id', batch);
    }
    console.log(`  Archived ${orphanIds.length} orphaned rows`);
  } else {
    console.log('  No orphaned rows found');
  }

  // ── Summary ────────────────────────────────────────────────────────────
  const { count: flatCount } = await supabase
    .from('product_variant_flat')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active');

  const { count: varCount } = await supabase
    .from('product_variant')
    .select('*', { count: 'exact', head: true });

  console.log('\n=== Complete ===');
  console.log(`product_variant_flat (Active): ${flatCount}`);
  console.log(`product_variant (total):       ${varCount}`);
  console.log(`Average variants per product:  ${(varCount / flatCount).toFixed(1)}`);
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
