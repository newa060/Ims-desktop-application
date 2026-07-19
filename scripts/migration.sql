-- Run this in Supabase SQL Editor BEFORE running the import script
-- Dashboard: https://supabase.com/dashboard → SQL Editor

-- Add new columns to products table (safe, won't affect existing data)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hs_code TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sub_group_a TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sub_group_b TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sub_group_c TEXT;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name IN ('hs_code','sub_group_a','sub_group_b','sub_group_c');
