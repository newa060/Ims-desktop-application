/**
 * rebuild_product_flat.js
 *
 * Generates a compact SQL file that:
 *  1. Upserts 2475 parent rows into product_variant_flat (one per item code)
 *  2. Re-links all product_variant rows to the correct parent via item_code
 *
 * Approach: single VALUES list per step — runs in seconds in Supabase.
 * Output: supabase/rebuild_product_flat.sql  (~200KB instead of 3.4MB)
 *
 * Run:  node scripts/rebuild_product_flat.js
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'supabase', 'rebuild_product_flat.sql');

// ── Load master ────────────────────────────────────────────────────────────
const wb   = XLSX.readFile(path.join(ROOT, 'Product_Master.xlsx'));
const ws   = wb.Sheets[wb.SheetNames[0]];
const masterRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
console.log(`Master rows: ${masterRows.length}`);

const masterByCode = new Map();
for (const row of masterRows) {
  const code = parseFloat(row['Item Code']);
  if (!isNaN(code)) masterByCode.set(code, row);
}

// ── Load CSV ───────────────────────────────────────────────────────────────
const csvText  = fs.readFileSync(path.join(ROOT, 'Supabase-producttable.csv'), 'utf8');
const csvLines = csvText.trim().split('\n');
const headers  = csvLines[0].split(',');
const col      = n => headers.indexOf(n);
const IDX = {
  id: col('id'), sku: col('sku'), name: col('name'), category: col('category'),
  price: col('price'), purchase: col('purchase_price'), wholesale: col('wholesale_price'),
  brand: col('brand'), unit: col('unit'), stock: col('stock'),
  colors: col('colors'), sizes: col('sizes'), barcode: col('barcode'),
  image: col('image'), status: col('status'),
  sub_a: col('sub_group_a'), sub_b: col('sub_group_b'), sub_c: col('sub_group_c'),
};

function parseCsvLine(line) {
  const res = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1]==='"'){cur+='"';i++;} else inQ=!inQ; }
    else if (ch === ',' && !inQ) { res.push(cur); cur=''; }
    else cur += ch;
  }
  res.push(cur); return res;
}

function skuToItemCode(sku) { return parseFloat(sku.replace(/-\d+$/, '')); }
function sq(v) {
  if (v===null||v===undefined||v==='') return 'NULL';
  return `'${String(v).replace(/'/g,"''")}'`;
}
function firstJson(raw) {
  if (!raw||raw==='[]') return null;
  try { const a=JSON.parse(raw); return a.length>0?a[0]:null; } catch{return null;}
}
function firstArr(raw) {
  if (!raw||raw==='{}'||raw==='[]') return null;
  const m=raw.match(/[\[{]"?([^"\]},]+)"?/); return m?m[1].trim():null;
}

// ── Build parent → variant mapping ─────────────────────────────────────────
// parentMap: itemCodeStr → { master, variantUUIDs[] }
const parentMap = new Map();
// variantParent: variantUUID → itemCodeStr
const variantParent = new Map();

let matched=0, unmatched=0;
const csvRows = [];

for (let i=1;i<csvLines.length;i++) {
  if (!csvLines[i].trim()) continue;
  const cols = parseCsvLine(csvLines[i]);
  const id   = cols[IDX.id]||'';
  const sku  = cols[IDX.sku]||'';
  if (!id) continue;

  const code    = skuToItemCode(sku);
  const codeStr = isNaN(code) ? null : String(code);
  const master  = codeStr ? masterByCode.get(code) : null;

  csvRows.push({ cols, id, sku, codeStr, master });

  if (master && codeStr) {
    if (!parentMap.has(codeStr)) parentMap.set(codeStr,[]);
    parentMap.get(codeStr).push(id);
    variantParent.set(id, codeStr);
    matched++;
  } else {
    unmatched++;
  }
}
console.log(`CSV: ${matched} matched, ${unmatched} unmatched`);
console.log(`Unique parents: ${parentMap.size}`);

// ── For each parent, pick the representative product_flat_id ───────────────
// We use the FIRST variant UUID as the parent's id (preserves existing FKs)
// parent_id_map: itemCodeStr → UUID (= first variant's current product_flat_id)
// We can't know the DB value at generation time, so we resolve it in SQL.

// ── Generate SQL ───────────────────────────────────────────────────────────
const out = [];

out.push(`-- ================================================================`);
out.push(`-- rebuild_product_flat.sql`);
out.push(`-- Generated: ${new Date().toISOString()}`);
out.push(`-- Parents:  ${parentMap.size}   Variants: ${matched}`);
out.push(`-- ================================================================`);
out.push(`begin;`);
out.push(``);

// ── STEP 1: Build item_code → product_flat_id mapping from existing variants
out.push(`-- Step 1: resolve existing parent ids from product_variant table`);
out.push(`create temp table _item_parent (`);
out.push(`  item_code_str  text    primary key,`);
out.push(`  parent_id      text    not null,`);
out.push(`  master_name    text,`);
out.push(`  category       text,`);
out.push(`  brand          text,`);
out.push(`  base_unit      text,`);
out.push(`  alt_unit       text,`);
out.push(`  c_factor       double precision,`);
out.push(`  purchase_price double precision,`);
out.push(`  selling_price  double precision,`);
out.push(`  wholesale_price double precision,`);
out.push(`  tax_rate       double precision,`);
out.push(`  slug           text`);
out.push(`) on commit drop;`);
out.push(``);

// Build VALUES for temp table
// For parent_id we pick the first variant's product_flat_id from DB
// We express this as a subquery per row

const parentEntries = [...parentMap.entries()];

// Build the INSERT into temp table in chunks of 200 rows
// Each row: (item_code_str, (subquery for parent_id), name, ...)
const CHUNK = 200;
for (let start = 0; start < parentEntries.length; start += CHUNK) {
  const chunk = parentEntries.slice(start, start + CHUNK);
  out.push(`insert into _item_parent`);
  out.push(`  (item_code_str, parent_id, master_name, category, brand, base_unit, alt_unit,`);
  out.push(`   c_factor, purchase_price, selling_price, wholesale_price, tax_rate, slug)`);

  const rows = chunk.map(([codeStr, variantIds]) => {
    const master  = masterByCode.get(parseFloat(codeStr));
    const name    = String(master['Item Name']||'').trim();
    const cat     = String(master['Main Group']||'').trim();
    const brand   = String(master['Sub Group A']||'').trim();
    const base    = String(master['Base Unit']||'').trim();
    const alt     = String(master['Alt Unit']||'').trim();
    const cf      = parseFloat(master['C-Factor'])||null;
    const pur     = parseFloat(master['P-Rate'])||0;
    const sell    = parseFloat(master['Selling Rate'])||0;
    const whole   = parseFloat(master['W-SRate'])||null;
    const tax     = master['VAT']==='Non-Taxable'?0:13;
    const slug    = `${codeStr}-${name}`.toLowerCase()
                     .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

    // Resolve parent_id from the first variant in the DB
    const firstId = variantIds[0];
    const pidSubq = `(select product_flat_id from product_variant where id='${firstId}'::uuid limit 1)`;

    return `  (${sq(codeStr)}, coalesce(${pidSubq}, gen_random_uuid()::text), `+
           `${sq(name)}, ${sq(cat)}, ${sq(brand)}, ${sq(base)}, ${sq(alt)}, `+
           `${cf??'NULL'}, ${pur}, ${sell}, ${whole??'NULL'}, ${tax}, ${sq(slug)})`;
  });

  out.push(`values`);
  out.push(rows.join(',\n'));
  out.push(`on conflict (item_code_str) do nothing;`);
  out.push(``);
}

// ── STEP 2: Upsert product_variant_flat from temp table
out.push(`-- Step 2: upsert product_variant_flat`);
out.push(`insert into product_variant_flat`);
out.push(`  (id, name, slug, category, brand, base_unit, alt_unit, c_factor,`);
out.push(`   purchase_price, selling_price, wholesale_price, tax_rate, status)`);
out.push(`select`);
out.push(`  parent_id, master_name, slug, category, brand, base_unit, alt_unit, c_factor,`);
out.push(`  purchase_price, selling_price, wholesale_price, tax_rate, 'Active'`);
out.push(`from _item_parent`);
out.push(`on conflict (id) do update set`);
out.push(`  name            = excluded.name,`);
out.push(`  slug            = excluded.slug,`);
out.push(`  category        = excluded.category,`);
out.push(`  brand           = excluded.brand,`);
out.push(`  base_unit       = excluded.base_unit,`);
out.push(`  purchase_price  = excluded.purchase_price,`);
out.push(`  selling_price   = excluded.selling_price,`);
out.push(`  wholesale_price = excluded.wholesale_price,`);
out.push(`  tax_rate        = excluded.tax_rate;`);
out.push(``);

// ── STEP 3: Re-link product_variant.product_flat_id
// Build: UPDATE product_variant SET product_flat_id = ... WHERE id IN (...)
// Group variants by their parent item_code_str, emit one UPDATE per parent
out.push(`-- Step 3: re-link variants to their correct parent`);

for (const [codeStr, variantIds] of parentEntries) {
  const idList = variantIds.map(id=>`'${id}'`).join(',');
  out.push(`update product_variant`);
  out.push(`  set product_flat_id = (select parent_id from _item_parent where item_code_str=${sq(codeStr)})`);
  out.push(`  where id::text in (${idList});`);
}
out.push(``);

// ── STEP 4: Delete orphaned product_variant_flat rows
out.push(`-- Step 4: archive old flat rows that no longer have any variants`);
out.push(`update product_variant_flat pvf`);
out.push(`  set status = 'Archived'`);
out.push(`  where not exists (`);
out.push(`    select 1 from product_variant pv where pv.product_flat_id = pvf.id`);
out.push(`  )`);
out.push(`  and pvf.status <> 'Archived';`);
out.push(``);

// ── STEP 5: Summary
out.push(`-- Step 5: summary counts`);
out.push(`select 'product_variant_flat total'   , count(*) from product_variant_flat`);
out.push(`union all`);
out.push(`select 'product_variant_flat active'  , count(*) from product_variant_flat where status='Active'`);
out.push(`union all`);
out.push(`select 'product_variant_flat archived', count(*) from product_variant_flat where status='Archived'`);
out.push(`union all`);
out.push(`select 'product_variant total'        , count(*) from product_variant`);
out.push(`union all`);
out.push(`select 'variants with null parent'    , count(*) from product_variant where product_flat_id is null`);
out.push(`union all`);
out.push(`select 'orphaned flat rows (active)'  , count(*)`);
out.push(`  from product_variant_flat pvf where status='Active'`);
out.push(`  and not exists (select 1 from product_variant pv where pv.product_flat_id=pvf.id);`);
out.push(``);
out.push(`commit;`);

fs.writeFileSync(OUT_PATH, out.join('\n'), 'utf8');
const sizeKB = Math.round(fs.statSync(OUT_PATH).size / 1024);
console.log(`\nSQL written to: ${OUT_PATH}`);
console.log(`Size: ${sizeKB}KB   Lines: ${out.length}`);
