-- C. Delete orphaned flat rows (old 1:1 rows replaced by correct parents)
DELETE FROM product_variant_flat pvf
WHERE status <> 'Archived'
  AND NOT EXISTS (SELECT 1 FROM product_variant pv WHERE pv.product_flat_id = pvf.id);

-- D. Summary check
SELECT 'product_variant_flat' AS tbl, COUNT(*) FROM product_variant_flat
UNION ALL
SELECT 'product_variant', COUNT(*) FROM product_variant
UNION ALL
SELECT 'orphan_variants', COUNT(*) FROM product_variant
  WHERE product_flat_id NOT IN (SELECT id FROM product_variant_flat);

COMMIT;