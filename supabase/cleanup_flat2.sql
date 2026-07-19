-- ================================================================
-- cleanup_flat2.sql
-- Final cleanup: consolidate remaining 676 old-slug flat rows.
--
-- For each old-slug flat row, find the matching item-code flat row
-- by name, re-point its variants, then delete the old row.
-- ================================================================

BEGIN;

-- Step 1: Re-point variants from old-slug flat rows to item-code flat rows
-- Matching on normalized name (lower + trim)
UPDATE product_variant pv
SET product_flat_id = good.id
FROM product_variant_flat old_flat
JOIN product_variant_flat good
  ON good.slug ~ '^\d+\.?\d*$'
  AND lower(regexp_replace(trim(good.name),  '\s+', ' ', 'g'))
    = lower(regexp_replace(trim(old_flat.name), '\s+', ' ', 'g'))
WHERE pv.product_flat_id = old_flat.id
  AND old_flat.slug !~ '^\d+\.?\d*$'
  AND old_flat.id <> good.id;

-- Step 2: For any remaining old-slug rows with no item-code match,
-- use the oldest item-code flat row of the same name group as parent
-- (self-consolidation: pick the one whose slug IS an item code)
UPDATE product_variant pv
SET product_flat_id = (
  SELECT pvf2.id
  FROM product_variant_flat pvf2
  WHERE pvf2.slug ~ '^\d+\.?\d*$'
    AND lower(regexp_replace(trim(pvf2.name), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(pvf_old.name), '\s+', ' ', 'g'))
  ORDER BY pvf2.created_at
  LIMIT 1
)
FROM product_variant_flat pvf_old
WHERE pv.product_flat_id = pvf_old.id
  AND pvf_old.slug !~ '^\d+\.?\d*$'
  AND EXISTS (
    SELECT 1 FROM product_variant_flat pvf2
    WHERE pvf2.slug ~ '^\d+\.?\d*$'
      AND lower(regexp_replace(trim(pvf2.name), '\s+', ' ', 'g'))
        = lower(regexp_replace(trim(pvf_old.name), '\s+', ' ', 'g'))
  );

-- Step 3: Now delete all old-slug flat rows with no variants
DELETE FROM product_variant_flat
WHERE slug !~ '^\d+\.?\d*$'
  AND NOT EXISTS (
    SELECT 1 FROM product_variant pv
    WHERE pv.product_flat_id = product_variant_flat.id
  );

-- Step 4: For any old-slug rows STILL remaining (no name match in master)
-- consolidate duplicates: keep one per name, re-point others, delete rest
WITH ranked AS (
  SELECT id,
         name,
         slug,
         ROW_NUMBER() OVER (
           PARTITION BY lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
           ORDER BY created_at
         ) AS rn
  FROM product_variant_flat
  WHERE slug !~ '^\d+\.?\d*$'
),
keepers AS (SELECT id, name FROM ranked WHERE rn = 1),
dupes   AS (SELECT id, name FROM ranked WHERE rn > 1)
UPDATE product_variant pv
SET product_flat_id = k.id
FROM dupes d
JOIN keepers k
  ON lower(regexp_replace(trim(k.name), '\s+', ' ', 'g'))
   = lower(regexp_replace(trim(d.name), '\s+', ' ', 'g'))
WHERE pv.product_flat_id = d.id;

-- Step 5: Delete duplicate old-slug rows now empty
DELETE FROM product_variant_flat
WHERE slug !~ '^\d+\.?\d*$'
  AND NOT EXISTS (
    SELECT 1 FROM product_variant pv
    WHERE pv.product_flat_id = product_variant_flat.id
  );

-- Step 6: Final summary
SELECT
  'product_variant_flat total'             AS description, COUNT(*) FROM product_variant_flat
UNION ALL
SELECT 'product_variant_flat (item-code)', COUNT(*) FROM product_variant_flat WHERE slug ~ '^\d+\.?\d*$'
UNION ALL
SELECT 'product_variant_flat (other)',     COUNT(*) FROM product_variant_flat WHERE slug !~ '^\d+\.?\d*$'
UNION ALL
SELECT 'product_variant total',            COUNT(*) FROM product_variant
UNION ALL
SELECT 'orphan variants',                  COUNT(*) FROM product_variant
  WHERE product_flat_id NOT IN (SELECT id FROM product_variant_flat);

COMMIT;
