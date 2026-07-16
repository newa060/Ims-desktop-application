-- ============================================================================
-- Patch: populate color and size on product_variant from public.products
--
-- Column types in public.products (confirmed):
--   colors  JSONB   — e.g. '["GREEN"]'  or '["DARK BLUE"]' or '[]'
--   sizes   TEXT[]  — e.g. '{"L"}'      or '{"32"}'        or '{"OS"}'
--   barcode TEXT    — matches product_variant.barcode 1-to-1
--   id      TEXT    — matches product_variant.product_flat_id
-- ============================================================================

-- ── 1. Update via BARCODE match (most precise) ────────────────────────────
update product_variant pv
set
  color = case
    when p.colors is not null
         and jsonb_array_length(p.colors) > 0
         and trim(p.colors->>0) <> ''
    then initcap(lower(trim(p.colors->>0)))
    else pv.color
  end,
  size = case
    when p.sizes is not null
         and array_length(p.sizes, 1) > 0
         and trim(p.sizes[1]) <> ''
         and lower(trim(p.sizes[1])) not in ('os','one size','onesize')
    then trim(p.sizes[1])
    else pv.size
  end
from public.products p
where p.barcode is not null
  and p.barcode <> ''
  and pv.barcode = p.barcode
  and (pv.color is null or pv.size is null);

-- ── 2. Update remaining via PRODUCT ID match (no barcode rows) ───────────
update product_variant pv
set
  color = case
    when p.colors is not null
         and jsonb_array_length(p.colors) > 0
         and trim(p.colors->>0) <> ''
    then initcap(lower(trim(p.colors->>0)))
    else pv.color
  end,
  size = case
    when p.sizes is not null
         and array_length(p.sizes, 1) > 0
         and trim(p.sizes[1]) <> ''
         and lower(trim(p.sizes[1])) not in ('os','one size','onesize')
    then trim(p.sizes[1])
    else pv.size
  end
from public.products p
where pv.product_flat_id = p.id
  and (pv.color is null or pv.size is null)
  and (
    (p.colors is not null and jsonb_array_length(p.colors) > 0)
    or
    (p.sizes is not null and array_length(p.sizes, 1) > 0)
  );

-- ── 3. Preview: first 100 rows that now have color or size ────────────────
select
  pvf.name   as product_name,
  pv.sku,
  pv.barcode,
  pv.color,
  pv.size,
  pv.stock
from product_variant pv
join product_variant_flat pvf on pvf.id = pv.product_flat_id
where pv.color is not null
   or pv.size  is not null
order by pvf.name
limit 100;

-- ── 4. Summary ────────────────────────────────────────────────────────────
select
  count(*)                                  as total_variants,
  count(*) filter (where color is not null) as with_color,
  count(*) filter (where size  is not null) as with_size,
  count(*) filter (where color is null
                     and size  is null)     as still_empty
from product_variant;
