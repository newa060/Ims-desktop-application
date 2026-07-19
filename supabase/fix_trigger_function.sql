-- ============================================================================
-- HOTFIX: Restore the set_updated_at() trigger function to camelCase.
-- Run this immediately in Supabase SQL Editor to fix the login error.
-- ============================================================================

-- 1. Restore the original camelCase trigger function used by all IMS tables
--    (users, roles, suppliers, purchases, sales, etc.)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

-- 2. Create the snake_case variant for the new product_variant tables
create or replace function public.set_updated_at_snake()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3. Re-point the product_variant table triggers to the snake_case function
--    (only needed if product_variant tables were already created)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_variant_flat'
  ) then
    execute $t$
      drop trigger if exists trg_pvf_updated_at on product_variant_flat;
      create trigger trg_pvf_updated_at
        before update on product_variant_flat
        for each row execute function public.set_updated_at_snake();
    $t$;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_variant'
  ) then
    execute $t$
      drop trigger if exists trg_pv_updated_at on product_variant;
      create trigger trg_pv_updated_at
        before update on product_variant
        for each row execute function public.set_updated_at_snake();
    $t$;
  end if;
end;
$$;
