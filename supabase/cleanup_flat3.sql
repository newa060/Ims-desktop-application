-- ================================================================
-- cleanup_flat3.sql
-- Consolidate duplicate names within the 177 remaining non-master
-- flat rows. E.g. "KNITTED TSHIRT- E08" appears multiple times —
-- keep ONE row, point all variants to it, delete the rest.
-- ================================================================

BEGIN;

-- Step 1: Re-point variants to the OLDEST flat row of each name group
UPDATE product_variant pv
SET product_flat_id = keeper.id
FROM product_variant_flat old_row
JOIN (
  SELECT DISTINCT ON (lower(regexp_replace(trim(name), '\s+', ' ', 'g')))
    id, name
  FROM product_variant_flat
  WHERE slug !~ '^\d+\.?\d*$'
  ORDER BY lower(regexp_replace(trim(name), '\s+', ' ', 'g')), created_at
) AS keeper
  ON lower(regexp_replace(trim(keeper.name), '\s+', ' ', 'g'))
   = lower(regexp_replace(trim(old_row.name), '\s+', ' ', 'g'))
WHERE pv.product_flat_id = old_row.id
  AND old_row.slug !~ '^\d+\.?\d*$'
  AND old_row.id <> keeper.id;

-- Step 2: Delete the now-empty duplicate rows
DELETE FROM product_variant_flat
WHERE slug !~ '^\d+\.?\d*$'
  AND NOT EXISTS (
    SELECT 1 FROM product_variant pv
    WHERE pv.product_flat_id = product_variant_flat.id
  );

-- Step 3: Final summary
SELECT
  'product_variant_flat total'           AS description, COUNT(*) FROM product_variant_flat
UNION ALL
SELECT 'product_variant_flat (master)',  COUNT(*) FROM product_variant_flat WHERE slug ~ '^\d+\.?\d*$'
UNION ALL
SELECT 'product_variant_flat (non-master)', COUNT(*) FROM product_variant_flat WHERE slug !~ '^\d+\.?\d*$'
UNION ALL
SELECT 'product_variant total',          COUNT(*) FROM product_variant
UNION ALL
SELECT 'orphan variants',                COUNT(*) FROM product_variant
  WHERE product_flat_id NOT IN (SELECT id FROM product_variant_flat);

COMMIT;
