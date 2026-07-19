/**
 * relink_variants.js
 *
 * The product_variant_flat table now has 2,476 correct Active parent rows.
 * But product_variant rows still point to old Archived flat rows.
 *
 * Fix: For each Active flat row, find all old flat rows with the same name,
 * then update product_variant.product_flat_id for all variants pointing to
 * those old rows → point them to the new Active row instead.
 *
 * Finally, delete (or archive) the old Archived flat rows that are now empty.
 *
 * Run: node scripts/relink_variants.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  // ── 1. Load ALL Active flat rows (paginate past 1000 limit)
  console.log('Loading Active flat rows...');
  let activeFlat = [];
  let pg = 0;
  const PG = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('product_variant_flat')
      .select('id, name')
      .eq('status', 'Active')
      .range(pg * PG, (pg + 1) * PG - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    activeFlat = activeFlat.concat(data);
    pg++;
    if (data.length < PG) break;
    await sleep(50);
  }
  console.log(`  ${activeFlat.length} Active flat rows`);

  // Build name → active_id map
  // Some names may map to multiple active rows (duplicates from master)
  // — use the first one found
  const nameToActiveId = new Map();
  for (const r of activeFlat) {
    const key = r.name.trim().toLowerCase();
    if (!nameToActiveId.has(key)) nameToActiveId.set(key, r.id);
  }

  // ── 2. Load all Archived flat rows (the 12,342 old rows to clean up)
  console.log('Loading Archived flat rows...');
  let allArchived = [];
  const PAGE = 1000;
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('product_variant_flat')
      .select('id, name')
      .eq('status', 'Archived')
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    allArchived = allArchived.concat(data);
    page++;
    if (data.length < PAGE) break;
  }
  console.log(`  ${allArchived.length} Archived flat rows`);

  // Build archived_id → active_id map via name matching
  const archivedToActive = new Map();
  let noMatch = 0;
  for (const r of allArchived) {
    const key = r.name.trim().toLowerCase();
    const activeId = nameToActiveId.get(key);
    if (activeId) {
      archivedToActive.set(r.id, activeId);
    } else {
      noMatch++;
    }
  }
  console.log(`  Matched: ${archivedToActive.size}  No match: ${noMatch}`);

  // ── 3. Group archived IDs by their target active ID
  // activeId → [archivedId1, archivedId2, ...]
  const activeToOldIds = new Map();
  for (const [oldId, newId] of archivedToActive) {
    if (!activeToOldIds.has(newId)) activeToOldIds.set(newId, []);
    activeToOldIds.get(newId).push(oldId);
  }

  // ── 4. For each active parent, update all variants that point to old flat IDs
  console.log('\nRe-linking variants...');
  let totalRelinked = 0;
  let parentsDone = 0;
  const BATCH = 100;

  for (const [activeId, oldIds] of activeToOldIds) {
    // Update variants: WHERE product_flat_id IN (oldIds) → SET product_flat_id = activeId
    for (let i = 0; i < oldIds.length; i += BATCH) {
      const chunk = oldIds.slice(i, i + BATCH);
      const { error, count } = await supabase
        .from('product_variant')
        .update({ product_flat_id: activeId })
        .in('product_flat_id', chunk);
      if (error) throw new Error(`Re-link error: ${error.message}`);
    }
    parentsDone++;
    if (parentsDone % 100 === 0) {
      process.stdout.write(`  ${parentsDone}/${activeToOldIds.size} parents processed\r`);
    }
    await sleep(15);
  }
  console.log(`  ${parentsDone} parents processed, all variants re-linked`);

  // ── 5. Count how many variants are now correctly linked
  const { count: linkedCount } = await supabase
    .from('product_variant')
    .select('*', { count: 'exact', head: true });

  // Check how many variants still point to Archived flat rows
  const archivedIds = allArchived.map(r => r.id);
  let stillArchived = 0;
  for (let i = 0; i < archivedIds.length; i += 500) {
    const chunk = archivedIds.slice(i, i + 500);
    const { count } = await supabase
      .from('product_variant')
      .select('*', { count: 'exact', head: true })
      .in('product_flat_id', chunk);
    stillArchived += (count || 0);
  }
  console.log(`\nVariants still pointing to Archived flat rows: ${stillArchived}`);

  // ── 6. Hard-delete the Archived flat rows (they're now empty)
  if (stillArchived === 0) {
    console.log('\nDeleting Archived flat rows...');
    let deleted = 0;
    for (let i = 0; i < archivedIds.length; i += BATCH) {
      const chunk = archivedIds.slice(i, i + BATCH);
      const { error } = await supabase
        .from('product_variant_flat')
        .delete()
        .in('id', chunk);
      if (error) throw new Error(`Delete error: ${error.message}`);
      deleted += chunk.length;
      if (deleted % 1000 === 0)
        process.stdout.write(`  Deleted ${deleted}/${archivedIds.length}\r`);
      await sleep(20);
    }
    console.log(`  Deleted ${deleted} Archived flat rows`);
  } else {
    console.log(`WARNING: ${stillArchived} variants still point to Archived rows — skipping delete`);
    console.log('Run this script again to retry.');
  }

  // ── Summary
  const { count: flatFinal } = await supabase
    .from('product_variant_flat')
    .select('*', { count: 'exact', head: true });
  const { count: varFinal } = await supabase
    .from('product_variant')
    .select('*', { count: 'exact', head: true });

  console.log('\n=== Final State ===');
  console.log(`product_variant_flat: ${flatFinal} rows`);
  console.log(`product_variant:      ${varFinal}  rows`);
  console.log(`Avg variants/product: ${(varFinal / flatFinal).toFixed(1)}`);
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
