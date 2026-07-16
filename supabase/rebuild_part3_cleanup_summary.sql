-- Step 4: archive old flat rows that no longer have any variants
update product_variant_flat pvf
  set status = 'Archived'
  where not exists (
    select 1 from product_variant pv where pv.product_flat_id = pvf.id
  )
  and pvf.status <> 'Archived';

-- Step 5: summary counts
select 'product_variant_flat total'   , count(*) from product_variant_flat
union all
select 'product_variant_flat active'  , count(*) from product_variant_flat where status='Active'
union all
select 'product_variant_flat archived', count(*) from product_variant_flat where status='Archived'
union all
select 'product_variant total'        , count(*) from product_variant
union all
select 'variants with null parent'    , count(*) from product_variant where product_flat_id is null
union all
select 'orphaned flat rows (active)'  , count(*)
  from product_variant_flat pvf where status='Active'
  and not exists (select 1 from product_variant pv where pv.product_flat_id=pvf.id);

commit;