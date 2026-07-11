-- ============================================================================
-- Inventory Management System — Supabase (Postgres) schema, v2
--
-- IMPORTANT: This project's Supabase database is SHARED with the AESTHETE
-- website (Men-s-Space, Next.js). The website's schema (profiles, products,
-- orders, order_items, addresses, cms_settings, feedback_items,
-- gallery_items, newsletter_subscribers) already exists — do NOT run the
-- website's own migrations again, and this script never recreates any of
-- those tables.
--
-- What this script does:
--  1. ALTERs the existing `public.products` table to add the extra columns
--     the desktop IMS needs (cost price, min stock threshold, barcode, tax
--     rate, brand/unit labels). All additive, nullable/defaulted, and
--     invisible to the website unless it chooses to read them — nothing
--     the storefront already relies on is touched or renamed.
--  2. Creates new tables that only the desktop app uses (staff accounts/
--     roles, suppliers, purchases, POS sales, inventory history, stock
--     adjustments, expense tracking, category/brand/unit lookup lists,
--     app settings). None of these names collide with the website's schema.
--  3. Adds RPC functions for the multi-step operations that must be atomic
--     (PostgREST has no client-side transactions).
--
-- Product catalog + stock now live in ONE table (`public.products`) that
-- both apps read/write — that's the actual "sync" between storefront and
-- desktop POS/warehouse tooling. Web checkout orders stay in the website's
-- own `orders`/`order_items` tables; in-store POS sales get their own
-- `sales`/`sale_items` tables below — both decrement the same
-- `products.stock` column, so inventory is always consistent everywhere.
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. Additive columns on the EXISTING shared `products` table
-- ============================================================================
alter table public.products
  add column if not exists purchase_price double precision not null default 0,
  add column if not exists wholesale_price double precision,
  add column if not exists minimum_stock integer not null default 0,
  add column if not exists barcode text,
  add column if not exists tax_rate double precision not null default 0,
  add column if not exists brand text,
  add column if not exists unit text;

create unique index if not exists products_barcode_key
  on public.products(barcode) where barcode is not null;

-- ============================================================================
-- 2. Staff accounts & RBAC (POS/desktop login — separate from customer
--    `profiles`, since staff aren't storefront accounts and this app uses
--    its own bcrypt-based auth rather than Supabase Auth).
-- ============================================================================
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);
drop trigger if exists trg_roles_updated_at on roles;
create trigger trg_roles_updated_at before update on roles
  for each row execute function public.set_updated_at();

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  "roleId" uuid not null references roles(id) on delete cascade,
  resource text not null,
  "canCreate" boolean not null default false,
  "canRead" boolean not null default false,
  "canUpdate" boolean not null default false,
  "canDelete" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists idx_permissions_role on permissions("roleId");
drop trigger if exists trg_permissions_updated_at on permissions;
create trigger trg_permissions_updated_at before update on permissions
  for each row execute function public.set_updated_at();

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text not null,
  "firstName" text not null,
  "lastName" text not null,
  phone text,
  avatar text,
  "roleId" uuid not null references roles(id),
  "isActive" boolean not null default true,
  "lastLogin" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);
create index if not exists idx_users_role on users("roleId");
drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. Category / brand / unit lookup lists for the IMS product form.
--    `products.category`/`products.brand`/`products.unit` stay plain text
--    columns (matching how the website already treats `category`) — these
--    tables are just managed suggestion lists, not enforced foreign keys,
--    so nothing about the website's existing product rows can break.
-- ============================================================================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  "parentId" uuid references categories(id),
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_categories_parent on categories("parentId");

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  logo text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);
drop trigger if exists trg_brands_updated_at on brands;
create trigger trg_brands_updated_at before update on brands
  for each row execute function public.set_updated_at();

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  "shortName" text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);
drop trigger if exists trg_units_updated_at on units;
create trigger trg_units_updated_at before update on units
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. Supplier & walk-in customer management (purely desktop concepts —
--    website customers are `public.profiles`, unaffected).
-- ============================================================================
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text not null,
  address text,
  city text,
  country text,
  "taxNumber" text,
  balance double precision not null default 0,
  "creditLimit" double precision not null default 0,
  description text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);
drop trigger if exists trg_suppliers_updated_at on suppliers;
create trigger trg_suppliers_updated_at before update on suppliers
  for each row execute function public.set_updated_at();

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text not null,
  address text,
  city text,
  country text,
  "taxNumber" text,
  "creditBalance" double precision not null default 0,
  "creditLimit" double precision not null default 0,
  "loyaltyPoints" integer not null default 0,
  description text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);
drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at before update on customers
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 5. Purchases (restocking from suppliers) — no website equivalent.
--    "productId" is TEXT to match public.products.id (TEXT primary key).
-- ============================================================================
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  "purchaseNumber" text unique not null,
  "supplierId" uuid not null references suppliers(id),
  "purchaseDate" timestamptz not null default now(),
  "dueDate" timestamptz,
  status text not null default 'pending',
  subtotal double precision not null default 0,
  "taxAmount" double precision not null default 0,
  "discountAmount" double precision not null default 0,
  "shippingCost" double precision not null default 0,
  "totalAmount" double precision not null default 0,
  "paidAmount" double precision not null default 0,
  "balanceAmount" double precision not null default 0,
  "paymentMethod" text,
  "paymentStatus" text not null default 'unpaid',
  notes text,
  "userId" uuid not null references users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);
create index if not exists idx_purchases_supplier on purchases("supplierId");
create index if not exists idx_purchases_user on purchases("userId");
drop trigger if exists trg_purchases_updated_at on purchases;
create trigger trg_purchases_updated_at before update on purchases
  for each row execute function public.set_updated_at();

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  "purchaseId" uuid not null references purchases(id) on delete cascade,
  "productId" text not null references public.products(id),
  quantity integer not null,
  "unitPrice" double precision not null,
  "taxRate" double precision not null default 0,
  "taxAmount" double precision not null default 0,
  "discountAmount" double precision not null default 0,
  "totalAmount" double precision not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists idx_purchase_items_purchase on purchase_items("purchaseId");
create index if not exists idx_purchase_items_product on purchase_items("productId");
drop trigger if exists trg_purchase_items_updated_at on purchase_items;
create trigger trg_purchase_items_updated_at before update on purchase_items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 6. In-store POS sales. Kept separate from the website's `orders` table
--    (different checkout flow, different RLS/ownership model) but both
--    decrement the SAME `products.stock` column, which is what actually
--    keeps stock in sync between the storefront and the till.
-- ============================================================================
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  "saleNumber" text unique not null,
  "customerId" uuid references customers(id),
  "saleDate" timestamptz not null default now(),
  status text not null default 'completed',
  subtotal double precision not null default 0,
  "taxAmount" double precision not null default 0,
  "discountAmount" double precision not null default 0,
  "totalAmount" double precision not null default 0,
  "paidAmount" double precision not null default 0,
  "changeAmount" double precision not null default 0,
  "paymentMethod" text not null,
  "paymentStatus" text not null default 'paid',
  notes text,
  "userId" uuid not null references users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);
create index if not exists idx_sales_customer on sales("customerId");
create index if not exists idx_sales_user on sales("userId");
drop trigger if exists trg_sales_updated_at on sales;
create trigger trg_sales_updated_at before update on sales
  for each row execute function public.set_updated_at();

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  "saleId" uuid not null references sales(id) on delete cascade,
  "productId" text not null references public.products(id),
  quantity integer not null,
  "unitPrice" double precision not null,
  "taxRate" double precision not null default 0,
  "taxAmount" double precision not null default 0,
  "discountAmount" double precision not null default 0,
  "totalAmount" double precision not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists idx_sale_items_sale on sale_items("saleId");
create index if not exists idx_sale_items_product on sale_items("productId");
drop trigger if exists trg_sale_items_updated_at on sale_items;
create trigger trg_sale_items_updated_at before update on sale_items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 7. Inventory tracking
-- ============================================================================
create table if not exists inventory_history (
  id uuid primary key default gen_random_uuid(),
  "productId" text not null references public.products(id),
  type text not null,
  "quantityChange" integer not null,
  "quantityBefore" integer not null,
  "quantityAfter" integer not null,
  reference text,
  "referenceId" text,
  notes text,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_inventory_history_product on inventory_history("productId");

create table if not exists stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  "productId" text not null references public.products(id),
  type text not null,
  quantity integer not null,
  reason text not null,
  notes text,
  "userId" uuid not null references users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists idx_stock_adjustments_product on stock_adjustments("productId");
drop trigger if exists trg_stock_adjustments_updated_at on stock_adjustments;
create trigger trg_stock_adjustments_updated_at before update on stock_adjustments
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 8. Expense management
-- ============================================================================
create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);
drop trigger if exists trg_expense_categories_updated_at on expense_categories;
create trigger trg_expense_categories_updated_at before update on expense_categories
  for each row execute function public.set_updated_at();

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  "categoryId" uuid not null references expense_categories(id),
  amount double precision not null,
  date timestamptz not null default now(),
  description text not null,
  reference text,
  "paymentMethod" text,
  receipt text,
  "userId" uuid not null references users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);
create index if not exists idx_expenses_category on expenses("categoryId");
create index if not exists idx_expenses_user on expenses("userId");
drop trigger if exists trg_expenses_updated_at on expenses;
create trigger trg_expenses_updated_at before update on expenses
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 9. IMS app settings (distinct from the website's `cms_settings`, which is
--    storefront content, not operational config like tax rate/invoice prefix)
-- ============================================================================
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  description text,
  category text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
drop trigger if exists trg_settings_updated_at on settings;
create trigger trg_settings_updated_at before update on settings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RPC functions (atomic multi-step operations — PostgREST has no
-- client-side transactions, so anything that must succeed/fail as a whole
-- is done in a single Postgres function instead).
-- ============================================================================

create or replace function public.increment_product_stock(p_product_id text, p_delta integer)
returns setof public.products
language plpgsql
as $$
begin
  return query
  update public.products
  set stock = stock + p_delta
  where id = p_product_id
  returning *;
end;
$$;

-- Creates a POS sale with its line items, decrements public.products.stock,
-- and writes inventory history — all inside one transaction.
create or replace function public.create_sale(payload jsonb)
returns setof sales
language plpgsql
as $$
declare
  v_item jsonb;
  v_subtotal double precision := 0;
  v_total_tax double precision := 0;
  v_item_subtotal double precision;
  v_item_tax double precision;
  v_total_amount double precision;
  v_change_amount double precision;
  v_balance_due double precision;
  v_payment_status text;
  v_sale_id uuid;
  v_sale_number text;
  v_product public.products%rowtype;
  v_item_total double precision;
  v_new_stock integer;
  v_discount_amount double precision := coalesce((payload->>'discountAmount')::double precision, 0);
  v_paid_amount double precision := coalesce((payload->>'paidAmount')::double precision, 0);
  v_customer_id uuid := nullif(payload->>'customerId', '')::uuid;
begin
  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_item_subtotal := (v_item->>'quantity')::numeric * (v_item->>'unitPrice')::numeric
                        - coalesce((v_item->>'discountAmount')::numeric, 0);
    v_item_tax := v_item_subtotal * coalesce((v_item->>'taxRate')::numeric, 0) / 100;
    v_subtotal := v_subtotal + v_item_subtotal;
    v_total_tax := v_total_tax + v_item_tax;
  end loop;

  v_total_amount := v_subtotal + v_total_tax - v_discount_amount;
  v_balance_due := v_total_amount - v_paid_amount;
  v_change_amount := greatest(v_paid_amount - v_total_amount, 0);

  -- Determine payment status from actual amounts
  v_payment_status := case
    when v_balance_due <= 0 then 'paid'
    when v_paid_amount > 0 then 'partial'
    else 'due'
  end;

  v_sale_number := 'SALE-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

  insert into sales (
    "saleNumber", "customerId", "userId", subtotal, "taxAmount", "discountAmount",
    "totalAmount", "paidAmount", "changeAmount", "paymentMethod", "paymentStatus", status, notes
  ) values (
    v_sale_number,
    v_customer_id,
    (payload->>'userId')::uuid,
    v_subtotal, v_total_tax, v_discount_amount, v_total_amount, v_paid_amount, v_change_amount,
    payload->>'paymentMethod', v_payment_status, 'completed', payload->>'notes'
  ) returning id into v_sale_id;

  -- If a named customer has an unpaid balance, add it to their creditBalance
  -- Also award 1 loyalty point for every 100 paid by a named customer
  if v_customer_id is not null then
    update customers
    set
      "creditBalance" = "creditBalance" + case when v_balance_due > 0 then v_balance_due else 0 end,
      "loyaltyPoints" = "loyaltyPoints" + floor(v_paid_amount / 100)::integer
    where id = v_customer_id;
  end if;

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    select * into v_product from public.products where id = (v_item->>'productId')::text for update;

    if not found then
      raise exception 'Product % not found', v_item->>'productId';
    end if;

    if v_product.stock < (v_item->>'quantity')::integer then
      raise exception 'Insufficient stock for product %', v_product.name;
    end if;

    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unitPrice')::numeric
                     - coalesce((v_item->>'discountAmount')::numeric, 0);
    v_item_total := v_item_total + v_item_total * coalesce((v_item->>'taxRate')::numeric, 0) / 100;

    insert into sale_items (
      "saleId", "productId", quantity, "unitPrice", "taxRate", "taxAmount", "discountAmount", "totalAmount"
    ) values (
      v_sale_id, v_product.id, (v_item->>'quantity')::integer, (v_item->>'unitPrice')::double precision,
      coalesce((v_item->>'taxRate')::double precision, 0),
      (v_item->>'quantity')::numeric * (v_item->>'unitPrice')::numeric * coalesce((v_item->>'taxRate')::numeric, 0) / 100,
      coalesce((v_item->>'discountAmount')::double precision, 0),
      v_item_total
    );

    v_new_stock := v_product.stock - (v_item->>'quantity')::integer;

    update public.products set stock = v_new_stock where id = v_product.id;

    insert into inventory_history (
      "productId", type, "quantityChange", "quantityBefore", "quantityAfter", reference, "referenceId"
    ) values (
      v_product.id, 'sale', -(v_item->>'quantity')::integer, v_product.stock, v_new_stock, 'Sale', v_sale_id::text
    );
  end loop;

  return query select * from sales where id = v_sale_id;
end;
$$;

-- Creates a purchase with its line items, increments public.products.stock,
-- and writes inventory history — all inside one transaction.
create or replace function public.create_purchase(payload jsonb)
returns setof purchases
language plpgsql
as $$
declare
  v_item jsonb;
  v_subtotal double precision := 0;
  v_total_tax double precision := 0;
  v_item_total double precision;
  v_total_amount double precision;
  v_paid_amount double precision := coalesce((payload->>'paidAmount')::double precision, 0);
  v_shipping_cost double precision := coalesce((payload->>'shippingCost')::double precision, 0);
  v_balance_amount double precision;
  v_payment_status text;
  v_purchase_id uuid;
  v_purchase_number text;
  v_product public.products%rowtype;
  v_new_stock integer;
begin
  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unitPrice')::numeric
                     - coalesce((v_item->>'discountAmount')::numeric, 0);
    v_subtotal := v_subtotal + v_item_total;
    v_total_tax := v_total_tax + (v_item_total * coalesce((v_item->>'taxRate')::numeric, 0) / 100);
  end loop;

  v_total_amount := v_subtotal + v_total_tax + v_shipping_cost;
  v_balance_amount := v_total_amount - v_paid_amount;
  v_payment_status := case
    when v_balance_amount <= 0 then 'paid'
    when v_paid_amount > 0 then 'partial'
    else 'unpaid'
  end;
  v_purchase_number := 'PUR-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

  insert into purchases (
    "purchaseNumber", "supplierId", "userId", subtotal, "taxAmount", "shippingCost",
    "totalAmount", "paidAmount", "balanceAmount", "paymentMethod", "paymentStatus", status, notes, "dueDate"
  ) values (
    v_purchase_number,
    (payload->>'supplierId')::uuid,
    (payload->>'userId')::uuid,
    v_subtotal, v_total_tax, v_shipping_cost, v_total_amount, v_paid_amount, v_balance_amount,
    payload->>'paymentMethod', v_payment_status, 'received', payload->>'notes',
    nullif(payload->>'dueDate', '')::timestamptz
  ) returning id into v_purchase_id;

  -- If there is an unpaid balance on the purchase, update the supplier's balance
  if v_balance_amount > 0 then
    update suppliers
    set balance = balance + v_balance_amount
    where id = (payload->>'supplierId')::uuid;
  end if;

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    select * into v_product from public.products where id = (v_item->>'productId')::text for update;

    if not found then
      raise exception 'Product % not found', v_item->>'productId';
    end if;

    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unitPrice')::numeric
                     - coalesce((v_item->>'discountAmount')::numeric, 0);

    insert into purchase_items (
      "purchaseId", "productId", quantity, "unitPrice", "taxRate", "taxAmount", "discountAmount", "totalAmount"
    ) values (
      v_purchase_id, v_product.id, (v_item->>'quantity')::integer, (v_item->>'unitPrice')::double precision,
      coalesce((v_item->>'taxRate')::double precision, 0),
      (v_item_total * coalesce((v_item->>'taxRate')::numeric, 0) / 100),
      coalesce((v_item->>'discountAmount')::double precision, 0),
      v_item_total
    );

    v_new_stock := v_product.stock + (v_item->>'quantity')::integer;

    update public.products set stock = v_new_stock where id = v_product.id;

    insert into inventory_history (
      "productId", type, "quantityChange", "quantityBefore", "quantityAfter", reference, "referenceId", notes
    ) values (
      v_product.id, 'purchase', (v_item->>'quantity')::integer, v_product.stock, v_new_stock,
      'Purchase', v_purchase_id::text, 'Purchase ' || v_purchase_number
    );
  end loop;

  return query select * from purchases where id = v_purchase_id;
end;
$$;

-- Applies a manual stock adjustment (addition/reduction), writes the
-- stock_adjustments row, and writes inventory history atomically.
create or replace function public.adjust_inventory(payload jsonb)
returns setof stock_adjustments
language plpgsql
as $$
declare
  v_product public.products%rowtype;
  v_type text := payload->>'type';
  v_quantity integer := (payload->>'quantity')::integer;
  v_change integer;
  v_new_stock integer;
  v_adjustment_id uuid;
begin
  select * into v_product from public.products where id = (payload->>'productId')::text for update;

  if not found then
    raise exception 'Product not found';
  end if;

  v_change := case when v_type = 'addition' then v_quantity else -v_quantity end;
  v_new_stock := v_product.stock + v_change;

  if v_new_stock < 0 then
    raise exception 'Insufficient stock';
  end if;

  update public.products set stock = v_new_stock where id = v_product.id;

  insert into stock_adjustments ("productId", type, quantity, reason, notes, "userId")
  values (v_product.id, v_type, v_quantity, payload->>'reason', payload->>'notes', (payload->>'userId')::uuid)
  returning id into v_adjustment_id;

  insert into inventory_history (
    "productId", type, "quantityChange", "quantityBefore", "quantityAfter", reference, "referenceId", notes
  ) values (
    v_product.id, 'adjustment', v_change, v_product.stock, v_new_stock,
    'Stock Adjustment', v_adjustment_id::text, payload->>'reason'
  );

  return query select * from stock_adjustments where id = v_adjustment_id;
end;
$$;

-- Top-selling products by quantity (POS sales only), used on the dashboard.
create or replace function public.get_top_products(limit_count integer default 5)
returns table (
  "productId" text,
  "productName" text,
  "quantitySold" bigint,
  "totalRevenue" double precision
)
language sql
as $$
  select
    si."productId",
    p.name as "productName",
    sum(si.quantity) as "quantitySold",
    sum(si."totalAmount") as "totalRevenue"
  from sale_items si
  join public.products p on p.id = si."productId"
  group by si."productId", p.name
  order by sum(si.quantity) desc
  limit limit_count;
$$;

-- ============================================================================
-- Seed data
-- ============================================================================
do $$
declare
  v_admin_role uuid;
  v_manager_role uuid;
  v_cashier_role uuid;
  v_resource text;
begin
  insert into roles (name, description) values ('admin', 'Full system access')
    on conflict (name) do nothing;
  insert into roles (name, description) values ('manager', 'Manage operations and view reports')
    on conflict (name) do nothing;
  insert into roles (name, description) values ('cashier', 'Process sales and manage customers')
    on conflict (name) do nothing;

  select id into v_admin_role from roles where name = 'admin';
  select id into v_manager_role from roles where name = 'manager';
  select id into v_cashier_role from roles where name = 'cashier';

  -- Admin: full access to every resource
  foreach v_resource in array array[
    'dashboard','products','categories','brands','units','suppliers','customers',
    'purchases','sales','inventory','expenses','reports','users','roles','settings','backup'
  ]
  loop
    insert into permissions ("roleId", resource, "canCreate", "canRead", "canUpdate", "canDelete")
    select v_admin_role, v_resource, true, true, true, true
    where not exists (
      select 1 from permissions where "roleId" = v_admin_role and permissions.resource = v_resource
    );
  end loop;

  -- Manager: create/read/update on operational resources, no delete
  foreach v_resource in array array[
    'dashboard','products','categories','brands','units','suppliers','customers',
    'purchases','sales','inventory','expenses','reports'
  ]
  loop
    insert into permissions ("roleId", resource, "canCreate", "canRead", "canUpdate", "canDelete")
    select v_manager_role, v_resource, true, true, true, false
    where not exists (
      select 1 from permissions where "roleId" = v_manager_role and permissions.resource = v_resource
    );
  end loop;

  -- Cashier: limited access
  insert into permissions ("roleId", resource, "canCreate", "canRead", "canUpdate", "canDelete")
  select v_cashier_role, r.resource, r."canCreate", true, r."canUpdate", false
  from (values
    ('dashboard', false, false),
    ('products', false, false),
    ('customers', true, true),
    ('sales', true, false)
  ) as r(resource, "canCreate", "canUpdate")
  where not exists (
    select 1 from permissions where "roleId" = v_cashier_role and permissions.resource = r.resource
  );

  -- Default staff accounts (passwords: admin123 / manager123 / cashier123 — change immediately)
  insert into users (email, password, "firstName", "lastName", phone, "roleId", "isActive")
  values (
    'admin@system.com',
    '$2b$10$irseRWuHQmSFMFqGlAsO1uh8UEytYoTZZFnWBZvJpQRZuqTiwbTqu',
    'System', 'Administrator', '+1234567890', v_admin_role, true
  ) on conflict (email) do nothing;

  insert into users (email, password, "firstName", "lastName", phone, "roleId", "isActive")
  values (
    'manager@system.com',
    '$2b$10$1FdUh3Y27BmiRQPQ5fFsH.cWWE8szbeexzscWgU/mtvMceem2rEIu',
    'Store', 'Manager', '+1234567891', v_manager_role, true
  ) on conflict (email) do nothing;

  insert into users (email, password, "firstName", "lastName", phone, "roleId", "isActive")
  values (
    'cashier@system.com',
    '$2b$10$TeF6FyWI00/FY4NfHhLtn.5/HLn3pGgS0dyr6xMQXDTm0qRe.YFrS',
    'John', 'Cashier', '+1234567892', v_cashier_role, true
  ) on conflict (email) do nothing;

  -- Seed the category/brand lookup lists from whatever the website's
  -- products already use, so the IMS dropdowns line up with real data.
  insert into categories (name)
  select distinct category from public.products
  where category is not null and category <> ''
  on conflict (name) do nothing;

  insert into brands (name)
  select distinct brand from public.products
  where brand is not null and brand <> ''
  on conflict (name) do nothing;

  -- Units
  insert into units (name, "shortName") values ('Piece', 'pcs') on conflict (name) do nothing;
  insert into units (name, "shortName") values ('Kilogram', 'kg') on conflict (name) do nothing;
  insert into units (name, "shortName") values ('Liter', 'L') on conflict (name) do nothing;

  -- Expense categories
  insert into expense_categories (name, description) values ('Rent', 'Monthly rent payments')
    on conflict (name) do nothing;
  insert into expense_categories (name, description) values ('Utilities', 'Electricity, water, internet')
    on conflict (name) do nothing;
  insert into expense_categories (name, description) values ('Salaries', 'Employee salaries and wages')
    on conflict (name) do nothing;

  -- Settings
  insert into settings (key, value, category) values
    ('business_name', 'Aesthete Studio', 'business'),
    ('business_email', 'business@example.com', 'business'),
    ('business_phone', '+1234567890', 'business'),
    ('business_address', '123 Main St', 'business'),
    ('currency', 'USD', 'general'),
    ('currency_symbol', '$', 'general'),
    ('tax_rate', '10', 'general'),
    ('invoice_prefix', 'INV', 'invoice'),
    ('invoice_footer', 'Thank you for your business!', 'invoice'),
    ('theme', 'light', 'appearance'),
    ('auto_backup', 'true', 'backup'),
    ('backup_interval', '24', 'backup')
  on conflict (key) do nothing;
end $$;
