# Website Integration Guide — Product Variants

The Supabase database now has two purpose-built tables:

| Table | Used by | Purpose |
|---|---|---|
| `product_variant_flat` | **Website** | One row per parent product — holds name, slug, pricing, category, brand |
| `product_variant` | **Desktop** | One row per sellable variant — holds SKU, barcode, color, size, stock |

Pricing (`purchase_price`, `selling_price`, `wholesale_price`) lives only in `product_variant_flat`.  
Stock lives only in `product_variant`.

---

## Migration applied

Run `supabase/migration_product_variants.sql` once in the Supabase SQL editor.  
It is **idempotent** — safe to run again.

What it does:
- Creates `product_variant_flat` and `product_variant` tables
- Migrates every existing `public.products` row → one parent + one "Default" variant
- Adds nullable `variant_id` FK to `sale_items`, `purchase_items`, `inventory_history`, `stock_adjustments`
- Creates RPC functions: `create_sale_v2`, `create_purchase_v2`, `adjust_inventory_variant`, `increment_variant_stock`, `get_top_products_v2`

---

## Website — Product List (one card per product)

```ts
// Supabase JS
const { data: products } = await supabase
  .from('product_variant_flat')
  .select(`
    id, name, slug, description,
    selling_price, purchase_price, wholesale_price,
    category, brand, image, images, status,
    variants:product_variant(id, stock, status)
  `)
  .eq('status', 'Active')
  .order('created_at', { ascending: false });

// Derive in_stock client-side
const withStock = (products ?? []).map((p) => ({
  ...p,
  inStock: p.variants.some((v: any) => v.status === 'Active' && v.stock > 0),
}));
```

---

## Website — Product Detail Page

```ts
// 1. Parent product
const { data: product } = await supabase
  .from('product_variant_flat')
  .select('*')
  .eq('slug', slug)
  .single();

// 2. Available variants
const { data: variants } = await supabase
  .from('product_variant')
  .select('id, variant_name, sku, barcode, color, size, stock, minimum_stock, image, status')
  .eq('product_flat_id', product.id)
  .eq('status', 'Active')
  .order('created_at', { ascending: true });
```

---

## Website — Variant Selector component

```tsx
// When customer selects color/size → find matching variant
const selectedVariant = variants.find(
  (v) => v.color === selectedColor && v.size === selectedSize
);

const inStock        = (selectedVariant?.stock ?? 0) > 0;
const purchasePrice  = product.purchase_price;   // always from parent
const sellingPrice   = product.selling_price;    // always from parent
```

---

## Stock availability badge on product card

```ts
// In Stock  = at least one Active variant has stock > 0
const inStock = variants.some((v) => v.status === 'Active' && v.stock > 0);
```

---

## Order flow (website checkout)

Send **both** `product_flat_id` and `variant_id` when inserting an order item:

```ts
// order_items row
{
  order_id:       orderId,
  product_flat_id: product.id,        // product_variant_flat.id
  variant_id:      selectedVariant.id, // product_variant.id
  quantity:        qty,
  price:           product.selling_price,
}

// Then decrement variant stock atomically
await supabase.rpc('increment_variant_stock', {
  p_variant_id: selectedVariant.id,
  p_delta:      -qty,
});
```

---

## Search

| App | Searches |
|---|---|
| **Desktop** | `product_variant` by name (via parent join), SKU, barcode, variant_name |
| **Website** | `product_variant_flat` by name, slug, category |

---

## Stock management rules

- Stock **only** exists in `product_variant.stock`
- `purchase_price` and `selling_price` **only** exist in `product_variant_flat`
- Deducting stock on a sale updates **only** the selected variant row
- Other variants of the same parent product are never touched

---

## RPC functions reference

| Function | Used for |
|---|---|
| `create_sale_v2(payload)` | POS sale — deducts variant stock |
| `create_purchase_v2(payload)` | Purchase — increments variant stock |
| `adjust_inventory_variant(payload)` | Manual stock adjustment |
| `increment_variant_stock(p_variant_id, p_delta)` | Atomic single-variant delta |
| `get_top_products_v2(limit_count)` | Dashboard top products |
