-- ================================================================
-- cleanup_flat.sql
-- Removes old product_variant_flat rows that are no longer needed.
--
-- After the relink, correctly mapped parents have slug = item_code
-- (e.g. '5.182', '1.434'). Old flat rows have slugs like
-- 'wind-jackets-5316-5-182-2' (word-based from original migration).
--
-- Safe delete: only removes rows whose slug does NOT look like a
-- numeric item code (digits.digits pattern).
-- ================================================================

BEGIN;

-- Step 1: Re-point any variants still on old flat rows
-- to the correct parent (slug = item_code format)
UPDATE product_variant pv
SET product_flat_id = new_parent.id
FROM product_variant_flat old_flat
JOIN product_variant_flat new_parent
  ON new_parent.slug ~ '^\d+\.?\d*$'   -- slug looks like an item code
  AND lower(trim(new_parent.name)) = lower(trim(old_flat.name))
WHERE pv.product_flat_id = old_flat.id
  AND old_flat.slug !~ '^\d+\.?\d*$';  -- old flat has non-numeric slug

-- Step 2: Delete old flat rows that now have no variants
DELETE FROM product_variant_flat
WHERE slug !~ '^\d+\.?\d*$'   -- not an item-code slug
  AND NOT EXISTS (
    SELECT 1 FROM product_variant pv
    WHERE pv.product_flat_id = product_variant_flat.id
  );

-- Step 3: Summary
SELECT
  'product_variant_flat total'    AS description, COUNT(*) FROM product_variant_flat
UNION ALL
SELECT 'product_variant_flat (item-code slugs)', COUNT(*) FROM product_variant_flat WHERE slug ~ '^\d+\.?\d*$'
UNION ALL
SELECT 'product_variant_flat (old slugs)',        COUNT(*) FROM product_variant_flat WHERE slug !~ '^\d+\.?\d*$'
UNION ALL
SELECT 'product_variant total',                   COUNT(*) FROM product_variant
UNION ALL
SELECT 'orphan variants',                         COUNT(*) FROM product_variant
  WHERE product_flat_id NOT IN (SELECT id FROM product_variant_flat);

COMMIT;
