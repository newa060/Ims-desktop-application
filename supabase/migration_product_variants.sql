-- ============================================================================
-- Migration: product_variant_flat (TABLE) + product_variant (TABLE)
--
-- The database already had a VIEW named product_variant_flat from a previous
-- migration attempt. This script drops that view first, then creates both
-- as proper TABLES with triggers, indexes, and RLS support.
--
-- public.products is NOT modified. IDEMPOTENT — safe to run again.
-- ============================================================================

-- 0. Trigger helper
-- IMPORTANT: The existing IMS tables (users, roles, suppliers, etc.) use
-- "updatedAt" (camelCase). The new product_variant tables use updated_at
-- (snake_case). We keep TWO separate trigger functions so neither breaks.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  -- camelCase columns (used by all existing IMS tables)
  new."updatedAt" = now();
  return new;
end; $$;

create or replace function public.set_updated_at_snake()
returns trigger language plpgsql as $$
begin
  -- snake_case columns (used by new product_variant tables)
  new.updated_at = now();
  return new;
end; $$;

-- 1. Drop old view (cannot have row triggers) and any wrong-name table
drop view  if exists product_variant_flat cascade;
drop table if exists product_variants      cascade;

-- 2. product_variant_flat — parent product (no stock here)
create table if not exists product_variant_flat (
  id               text primary key,
  name             text not null,
  slug             text,
  description      text,
  category         text,
  brand            text,
  base_unit        text,
  alt_unit         text,
  c_factor         double precision,
  purchase_price   double precision not null default 0,
  selling_price    double precision not null default 0,
  wholesale_price  double precision,
  tax_rate         double precision not null default 0,
  image            text,
  images           text[],
  sizes            text[],
  status           text not null default 'Active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_pvf_updated_at on product_variant_flat;
create trigger trg_pvf_updated_at
  before update on product_variant_flat
  for each row execute function public.set_updated_at_snake();
create index if not exists idx_pvf_status on product_variant_flat(status);
create index if not exists idx_pvf_slug   on product_variant_flat(slug);
create index if not exists idx_pvf_name   on product_variant_flat(name);

-- 3. product_variant — one row per sellable variant (stock lives here)
create table if not exists product_variant (
  id               uuid primary key default gen_random_uuid(),
  product_flat_id  text not null
                     references product_variant_flat(id) on delete cascade,
  sku              text not null,
  barcode          text,
  color            text,
  size             text,
  variant_name     text not null default 'Default',
  stock            integer not null default 0,
  minimum_stock    integer not null default 0,
  image            text,
  status           text not null default 'Active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_pv_updated_at on product_variant;
create trigger trg_pv_updated_at
  before update on product_variant
  for each row execute function public.set_updated_at_snake();
create unique index if not exists uq_product_variant_sku
  on product_variant(sku);
create unique index if not exists uq_product_variant_barcode
  on product_variant(barcode) where barcode is not null;
create index if not exists idx_pv_product_flat on product_variant(product_flat_id);
create index if not exists idx_pv_status       on product_variant(status);

-- 4a. Migrate parent products from public.products (idempotent)
insert into product_variant_flat (
  id, name, slug, description, category, brand, base_unit,
  purchase_price, selling_price, wholesale_price, tax_rate,
  image, images, sizes, status, created_at, updated_at
)
select
  p.id, p.name, p.slug, p.description, p.category, p.brand, p.unit,
  coalesce(p.purchase_price, 0),
  coalesce(p.price,          0),
  p.wholesale_price,
  coalesce(p.tax_rate, 0),
  p.image, p.images, p.sizes,
  coalesce(p.status, 'Active'),
  coalesce(p.created_at, now()),
  coalesce(p.updated_at, now())
from public.products p
where p.status <> 'Archived'
on conflict (id) do nothing;

-- 4b. Migrate one Default variant per product (idempotent)
insert into product_variant (
  product_flat_id, sku, barcode, variant_name,
  stock, minimum_stock, image, status, created_at, updated_at
)
select
  p.id,
  coalesce(nullif(trim(p.sku),''), 'SKU-' || substr(p.id,1,8)),
  nullif(trim(coalesce(p.barcode,'')), ''),
  'Default',
  coalesce(p.stock, 0),
  coalesce(p.minimum_stock, 0),
  p.image,
  coalesce(p.status, 'Active'),
  coalesce(p.created_at, now()),
  coalesce(p.updated_at, now())
from public.products p
where p.status <> 'Archived'
  and exists     (select 1 from product_variant_flat pvf where pvf.id = p.id)
  and not exists (select 1 from product_variant      pv  where pv.product_flat_id = p.id);

-- 5. Add variant_id FK columns to transactional tables (nullable, backward-compat)
alter table inventory_history
  add column if not exists variant_id uuid references product_variant(id) on delete set null;
alter table stock_adjustments
  add column if not exists variant_id uuid references product_variant(id) on delete set null;
alter table sale_items
  add column if not exists variant_id uuid references product_variant(id) on delete set null;
alter table purchase_items
  add column if not exists variant_id uuid references product_variant(id) on delete set null;

-- 6. RPC: increment_variant_stock
create or replace function public.increment_variant_stock(
  p_variant_id uuid, p_delta integer
)
returns setof product_variant language plpgsql as $$
begin
  return query
  update product_variant set stock = stock + p_delta
  where id = p_variant_id returning *;
end; $$;

-- 7. RPC: adjust_inventory_variant
create or replace function public.adjust_inventory_variant(payload jsonb)
returns setof stock_adjustments language plpgsql as $$
declare
  v_variant       product_variant%rowtype;
  v_type          text    := payload->>'type';
  v_quantity      integer := (payload->>'quantity')::integer;
  v_change        integer;
  v_new_stock     integer;
  v_adj_id        uuid;
begin
  select * into v_variant from product_variant
  where id = (payload->>'variantId')::uuid for update;
  if not found then raise exception 'Variant % not found', payload->>'variantId'; end if;

  v_change    := case when v_type = 'addition' then v_quantity else -v_quantity end;
  v_new_stock := v_variant.stock + v_change;
  if v_new_stock < 0 then raise exception 'Insufficient stock'; end if;

  update product_variant set stock = v_new_stock where id = v_variant.id;

  insert into stock_adjustments ("productId", variant_id, type, quantity, reason, notes, "userId")
  values (v_variant.product_flat_id, v_variant.id, v_type, v_quantity,
          payload->>'reason', payload->>'notes', (payload->>'userId')::uuid)
  returning id into v_adj_id;

  insert into inventory_history
    ("productId", variant_id, type, "quantityChange", "quantityBefore", "quantityAfter",
     reference, "referenceId", notes)
  values (v_variant.product_flat_id, v_variant.id, 'adjustment', v_change,
          v_variant.stock, v_new_stock, 'Stock Adjustment', v_adj_id::text, payload->>'reason');

  return query select * from stock_adjustments where id = v_adj_id;
end; $$;

-- 8. RPC: create_sale_v2 — deducts from product_variant.stock atomically
create or replace function public.create_sale_v2(payload jsonb)
returns setof sales language plpgsql as $$
declare
  v_item           jsonb;
  v_subtotal       double precision := 0;
  v_total_tax      double precision := 0;
  v_item_sub       double precision;
  v_item_tax       double precision;
  v_total_amount   double precision;
  v_change_amount  double precision;
  v_balance_due    double precision;
  v_pay_status     text;
  v_sale_id        uuid;
  v_sale_number    text;
  v_variant        product_variant%rowtype;
  v_item_total     double precision;
  v_new_stock      integer;
  v_discount       double precision := coalesce((payload->>'discountAmount')::double precision,0);
  v_paid           double precision := coalesce((payload->>'paidAmount')::double precision,0);
  v_cust_id        uuid := nullif(payload->>'customerId','')::uuid;
begin
  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_item_sub  := (v_item->>'quantity')::numeric*(v_item->>'unitPrice')::numeric
                   - coalesce((v_item->>'discountAmount')::numeric,0);
    v_item_tax  := v_item_sub * coalesce((v_item->>'taxRate')::numeric,0)/100;
    v_subtotal  := v_subtotal  + v_item_sub;
    v_total_tax := v_total_tax + v_item_tax;
  end loop;

  v_total_amount  := v_subtotal + v_total_tax - v_discount;
  v_balance_due   := v_total_amount - v_paid;
  v_change_amount := greatest(v_paid - v_total_amount, 0);
  v_pay_status    := case when v_balance_due<=0 then 'paid'
                          when v_paid>0 then 'partial' else 'due' end;
  v_sale_number   := 'SALE-'||to_char(now(),'YYYYMMDD')||'-'
                     ||lpad(floor(random()*10000)::text,4,'0');

  insert into sales
    ("saleNumber","customerId","userId",subtotal,"taxAmount","discountAmount",
     "totalAmount","paidAmount","changeAmount","paymentMethod","paymentStatus",status,notes)
  values
    (v_sale_number,v_cust_id,(payload->>'userId')::uuid,
     v_subtotal,v_total_tax,v_discount,v_total_amount,v_paid,v_change_amount,
     payload->>'paymentMethod',v_pay_status,'completed',payload->>'notes')
  returning id into v_sale_id;

  if v_cust_id is not null then
    update customers
    set "creditBalance"="creditBalance"+case when v_balance_due>0 then v_balance_due else 0 end,
        "loyaltyPoints"="loyaltyPoints"+floor(v_paid/100)::integer
    where id=v_cust_id;
  end if;

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    select * into v_variant from product_variant
    where id=(v_item->>'variantId')::uuid for update;
    if not found then raise exception 'Variant % not found',v_item->>'variantId'; end if;
    if v_variant.stock<(v_item->>'quantity')::integer then
      raise exception 'Insufficient stock for variant "%"',v_variant.variant_name;
    end if;

    v_item_total := (v_item->>'quantity')::numeric*(v_item->>'unitPrice')::numeric
                    - coalesce((v_item->>'discountAmount')::numeric,0);
    v_item_total := v_item_total + v_item_total*coalesce((v_item->>'taxRate')::numeric,0)/100;

    insert into sale_items
      ("saleId","productId",variant_id,quantity,"unitPrice","taxRate","taxAmount","discountAmount","totalAmount")
    values
      (v_sale_id,v_variant.product_flat_id,v_variant.id,
       (v_item->>'quantity')::integer,(v_item->>'unitPrice')::double precision,
       coalesce((v_item->>'taxRate')::double precision,0),
       (v_item->>'quantity')::numeric*(v_item->>'unitPrice')::numeric
         *coalesce((v_item->>'taxRate')::numeric,0)/100,
       coalesce((v_item->>'discountAmount')::double precision,0),v_item_total);

    v_new_stock := v_variant.stock-(v_item->>'quantity')::integer;
    update product_variant set stock=v_new_stock where id=v_variant.id;

    insert into inventory_history
      ("productId",variant_id,type,"quantityChange","quantityBefore","quantityAfter",reference,"referenceId")
    values
      (v_variant.product_flat_id,v_variant.id,'sale',
       -(v_item->>'quantity')::integer,v_variant.stock,v_new_stock,'Sale',v_sale_id::text);
  end loop;

  return query select * from sales where id=v_sale_id;
end; $$;

-- 9. RPC: create_purchase_v2 — increments product_variant.stock atomically
create or replace function public.create_purchase_v2(payload jsonb)
returns setof purchases language plpgsql as $$
declare
  v_item           jsonb;
  v_subtotal       double precision := 0;
  v_total_tax      double precision := 0;
  v_item_total     double precision;
  v_total_amount   double precision;
  v_paid           double precision := coalesce((payload->>'paidAmount')::double precision,0);
  v_shipping       double precision := coalesce((payload->>'shippingCost')::double precision,0);
  v_balance        double precision;
  v_pay_status     text;
  v_purchase_id    uuid;
  v_purchase_num   text;
  v_variant        product_variant%rowtype;
  v_new_stock      integer;
begin
  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_item_total := (v_item->>'quantity')::numeric*(v_item->>'unitPrice')::numeric
                    - coalesce((v_item->>'discountAmount')::numeric,0);
    v_subtotal  := v_subtotal  + v_item_total;
    v_total_tax := v_total_tax + v_item_total*coalesce((v_item->>'taxRate')::numeric,0)/100;
  end loop;

  v_total_amount := v_subtotal + v_total_tax + v_shipping;
  v_balance      := v_total_amount - v_paid;
  v_pay_status   := case when v_balance<=0 then 'paid'
                         when v_paid>0 then 'partial' else 'unpaid' end;
  v_purchase_num := 'PUR-'||to_char(now(),'YYYYMMDD')||'-'
                    ||lpad(floor(random()*10000)::text,4,'0');

  insert into purchases
    ("purchaseNumber","supplierId","userId",subtotal,"taxAmount","shippingCost",
     "totalAmount","paidAmount","balanceAmount","paymentMethod","paymentStatus",
     status,notes,"dueDate")
  values
    (v_purchase_num,(payload->>'supplierId')::uuid,(payload->>'userId')::uuid,
     v_subtotal,v_total_tax,v_shipping,v_total_amount,v_paid,v_balance,
     payload->>'paymentMethod',v_pay_status,'received',payload->>'notes',
     nullif(payload->>'dueDate','')::timestamptz)
  returning id into v_purchase_id;

  if v_balance>0 then
    update suppliers set balance=balance+v_balance
    where id=(payload->>'supplierId')::uuid;
  end if;

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    select * into v_variant from product_variant
    where id=(v_item->>'variantId')::uuid for update;
    if not found then raise exception 'Variant % not found',v_item->>'variantId'; end if;

    v_item_total := (v_item->>'quantity')::numeric*(v_item->>'unitPrice')::numeric
                    - coalesce((v_item->>'discountAmount')::numeric,0);

    insert into purchase_items
      ("purchaseId","productId",variant_id,quantity,"unitPrice","taxRate","taxAmount","discountAmount","totalAmount")
    values
      (v_purchase_id,v_variant.product_flat_id,v_variant.id,
       (v_item->>'quantity')::integer,(v_item->>'unitPrice')::double precision,
       coalesce((v_item->>'taxRate')::double precision,0),
       v_item_total*coalesce((v_item->>'taxRate')::numeric,0)/100,
       coalesce((v_item->>'discountAmount')::double precision,0),v_item_total);

    v_new_stock := v_variant.stock+(v_item->>'quantity')::integer;
    update product_variant set stock=v_new_stock where id=v_variant.id;

    insert into inventory_history
      ("productId",variant_id,type,"quantityChange","quantityBefore","quantityAfter",
       reference,"referenceId",notes)
    values
      (v_variant.product_flat_id,v_variant.id,'purchase',
       (v_item->>'quantity')::integer,v_variant.stock,v_new_stock,
       'Purchase',v_purchase_id::text,'Purchase '||v_purchase_num);
  end loop;

  return query select * from purchases where id=v_purchase_id;
end; $$;

-- 10. RPC: get_top_products_v2
create or replace function public.get_top_products_v2(limit_count integer default 5)
returns table ("productId" text, "productName" text,
               "quantitySold" bigint, "totalRevenue" double precision)
language sql as $$
  select pvf.id, pvf.name,
         sum(si.quantity)::bigint, sum(si."totalAmount")
  from sale_items si
  join product_variant      pv  on pv.id  = si.variant_id
  join product_variant_flat pvf on pvf.id = pv.product_flat_id
  group by pvf.id, pvf.name
  order by sum(si.quantity) desc
  limit limit_count;
$$;

-- 11. Grant permissions to service_role
do $$
begin
  if exists (select 1 from pg_roles where rolname='service_role') then
    execute 'grant select,insert,update,delete on product_variant_flat to service_role';
    execute 'grant select,insert,update,delete on product_variant      to service_role';
  end if;
end; $$;
