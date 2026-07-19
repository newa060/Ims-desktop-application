-- ============================================================
-- Drop status column from product_variant
-- Run this in Supabase SQL Editor AFTER deploying the updated app.
-- ============================================================

-- Drop the column
ALTER TABLE public.product_variant
  DROP COLUMN IF EXISTS status;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'product_variant'
ORDER BY ordinal_position;
