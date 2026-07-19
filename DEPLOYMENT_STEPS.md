# Deployment Steps — Product Variants Refactor

Follow these steps in order. Do NOT skip any step.

---

## Step 1 — Run the database migration in Supabase

1. Open your Supabase project → SQL Editor
2. Open the file: `supabase/migration_product_variants.sql`
3. Copy the entire contents and paste into the SQL Editor
4. Click **Run**

Expected result: No errors. The script creates:
- `product_variant_flat` table (parent products)
- `product_variant` table (variants with stock)
- Migrates all existing `products` rows → one parent + one "Default" variant each
- Adds `variant_id` FK column to `sale_items`, `purchase_items`, `inventory_history`, `stock_adjustments`
- Creates RPC functions: `create_sale_v2`, `create_purchase_v2`, `adjust_inventory_variant`, `increment_variant_stock`, `get_top_products_v2`

> The migration is **idempotent** — safe to run again if needed.

---

## Step 2 — Verify migration data

Run these queries in the Supabase SQL Editor to confirm:

```sql
-- Should match the number of active products you had before
SELECT COUNT(*) FROM product_variant_flat WHERE status <> 'Archived';

-- Should equal the same count (one Default variant per product)
SELECT COUNT(*) FROM product_variant WHERE variant_name = 'Default';

-- Verify no data was lost
SELECT pvf.name, pv.sku, pv.stock
FROM product_variant_flat pvf
JOIN product_variant pv ON pv.product_flat_id = pvf.id
LIMIT 20;
```

---

## Step 3 — Build and run the desktop app

```bash
npm run dev
```

Or for production:

```bash
npm run build:win
```

---

## Step 4 — What changed in the Desktop

| Feature | Before | After |
|---|---|---|
| Products page | One row per product | One row per **variant** (same visual) |
| Add Product | Creates product | Creates parent + default variant |
| Add Variant | Not available | New button per product row |
| POS barcode search | Searches `products` | Searches `product_variant` |
| Stock adjustment | Adjusts product stock | Adjusts **variant** stock |
| Inventory history | Shows product name | Shows product name + variant |
| Low stock alerts | By product | By **variant** |
| Sales | Uses `create_sale` | Uses `create_sale_v2` (variant-level) |
| Purchases | Uses `create_purchase` | Uses `create_purchase_v2` (variant-level) |
| Reports | Stock reports use products | Stock reports use **variants** |
| Dashboard KPIs | Counts products | Counts parent products + variant stock |

---

## Step 5 — Website integration

See `WEBSITE_INTEGRATION.md` for:
- Product list query (one card per parent product)
- Product detail query (parent + all variants)
- Variant selector component
- Order flow (sends `product_flat_id` + `variant_id`)
- Stock deduction RPC

---

## Step 6 — Adding real product variants (post-migration)

For any product that has multiple variants (e.g. Shirt in Black, White, Blue):

1. Open the Desktop app → Products page
2. Find "Shirt" (shows as "Shirt - Default")
3. Click the **Layers icon** to expand variants
4. Click **Add Variant**
5. Fill in: Variant Name = "Black", Color = "Black", SKU, Stock
6. Repeat for White, Blue
7. Archive the "Default" variant if no longer needed

---

## Rollback

If you need to rollback:
- The migration does NOT drop or alter `public.products`
- The old `products:*` IPC handlers and `ProductRepository` are still in place
- Simply revert the application code to the previous git commit
- The new tables (`product_variant_flat`, `product_variant`) can be dropped:

```sql
DROP TABLE IF EXISTS product_variant CASCADE;
DROP TABLE IF EXISTS product_variant_flat CASCADE;
```

---

## Architecture summary

```
public.products          ← untouched, still used by website's own order flow
product_variant_flat     ← parent products (website product listing)
product_variant          ← variants with stock (desktop operations)

sale_items.variant_id    → product_variant.id  (new, nullable)
purchase_items.variant_id → product_variant.id (new, nullable)
inventory_history.variant_id → product_variant.id (new, nullable)
```
