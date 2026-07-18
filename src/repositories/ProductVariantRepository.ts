/**
 * ProductVariantRepository
 *
 * Reads from / writes to:
 *   product_variant       — per-variant rows (stock, sku, barcode, color, size…)
 *   product_variant_flat  — parent product rows (name, prices, category…)
 *
 * Desktop always works at the variant level.
 * Website works at the parent (product_variant_flat) level.
 */
import { BaseRepository } from './BaseRepository';
import {
  ProductVariant,
  ParentProduct,
  ProductVariantFormData,
  ParentProductFormData,
  PaginationParams,
  PaginatedResponse,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

// ── Column selects ────────────────────────────────────────────────────────────

const VARIANT_COLS =
  'id, product_flat_id, sku, barcode, color, size, variant_name, ' +
  'stock, minimum_stock, image, created_at, updated_at';

const VARIANT_WITH_PARENT =
  VARIANT_COLS +
  ', parent:product_variant_flat(' +
  '  id, name, slug, purchase_price, selling_price, wholesale_price,' +
  '  tax_rate, category, brand, base_unit, image, status' +
  ')';

const PARENT_COLS =
  'id, name, slug, description, category, brand, base_unit, alt_unit, c_factor,' +
  'purchase_price, selling_price, wholesale_price, tax_rate,' +
  'image, images, sizes, status, created_at, updated_at,' +
  'variants:product_variant(stock)';

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapVariant(row: any): ProductVariant {
  const p = row.parent;
  return {
    id:             row.id,
    productFlatId:  row.product_flat_id,
    variantName:    row.variant_name ?? 'Default',
    sku:            row.sku,
    barcode:        row.barcode   ?? undefined,
    color:          row.color     ?? undefined,
    size:           row.size      ?? undefined,
    stock:          row.stock     ?? 0,
    minimumStock:   row.minimum_stock ?? 0,
    image:          row.image     ?? undefined,
    // status is inherited from the parent product (product_variant_flat)
    status:         p?.status ?? undefined,
    purchasePrice:  p?.purchase_price ?? undefined,
    sellingPrice:   p?.selling_price  ?? undefined,
    wholesalePrice: p?.wholesale_price ?? undefined,
    taxRate:        p?.tax_rate ?? undefined,
    productName:    p?.name ?? undefined,
    parent: p ? mapParent(p) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapParent(row: any): ParentProduct {
  const vars = row.variants || [];
  const totalStock = Array.isArray(vars)
    ? vars.reduce((sum: number, v: any) => sum + (v.stock || 0), 0)
    : 0;

  return {
    id:             row.id,
    name:           row.name,
    slug:           row.slug ?? undefined,
    description:    row.description ?? undefined,
    category:       row.category ?? undefined,
    brand:          row.brand ?? undefined,
    baseUnit:       row.base_unit ?? undefined,
    altUnit:        row.alt_unit ?? undefined,
    cFactor:        row.c_factor ?? undefined,
    purchasePrice:  row.purchase_price ?? 0,
    sellingPrice:   row.selling_price  ?? 0,
    wholesalePrice: row.wholesale_price ?? undefined,
    taxRate:        row.tax_rate ?? 0,
    image:          row.image ?? undefined,
    images:         Array.isArray(row.images) ? row.images : undefined,
    sizes:          Array.isArray(row.sizes)  ? row.sizes  : undefined,
    status:         row.status,
    totalStock,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ── Repository ────────────────────────────────────────────────────────────────

export class ProductVariantRepository extends BaseRepository<ProductVariant> {
  protected getTableName(): string {
    return 'product_variant';
  }

  // ── Paginated list (search by name, sku, barcode, variant_name) ───────────

  async findAllWithPagination(
    params: PaginationParams
  ): Promise<PaginatedResponse<ProductVariant>> {
    const { search, page, limit } = params;
    const { from, to } = this.buildPagination(params);

    // Build base query via the parent join
    let variantQuery = this.supabase
      .from('product_variant')
      .select(VARIANT_WITH_PARENT, { count: 'exact' });

    if (search) {
      // Search variant fields directly; also filter by parent name via the join
      variantQuery = variantQuery.or(
        `sku.ilike.%${search}%,barcode.ilike.%${search}%,variant_name.ilike.%${search}%`
      );
    }

    const { data: variantRows, error: variantError, count } = await variantQuery
      .order('created_at', { ascending: false })
      .range(from, to);

    if (variantError) throw variantError;

    // If searching by product name, we need a second pass to include name matches
    let results = (variantRows || []).map(mapVariant);

    if (search) {
      // Also fetch variants whose parent name matches
      const { data: nameRows, error: nameError } = await this.supabase
        .from('product_variant')
        .select(VARIANT_WITH_PARENT)
        .order('created_at', { ascending: false });

      if (!nameError && nameRows) {
        const nameMatches = (nameRows as any[])
          .filter((r: any) => r.parent?.name?.toLowerCase().includes(search.toLowerCase()))
          .map(mapVariant);

        // Merge, deduplicate by id
        const seen = new Set(results.map((v) => v.id));
        for (const v of nameMatches) {
          if (!seen.has(v.id)) {
            results.push(v);
            seen.add(v.id);
          }
        }
      }
    }

    return this.toPaginatedResponse(results, count || results.length, page, limit);
  }

  // ── Variants for a parent product ────────────────────────────────────────

  async findByProductFlatId(productFlatId: string): Promise<ProductVariant[]> {
    const { data, error } = await this.supabase
      .from('product_variant')
      .select(VARIANT_WITH_PARENT)
      .eq('product_flat_id', productFlatId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapVariant);
  }

  /** Fetch variants for multiple parent IDs in ONE query — used by VariantsPage */
  async findByProductFlatIds(productFlatIds: string[]): Promise<ProductVariant[]> {
    if (productFlatIds.length === 0) return [];

    // Supabase .in() handles up to 1000 values; for a page of 50 parents this is fine
    const { data, error } = await this.supabase
      .from('product_variant')
      .select(VARIANT_WITH_PARENT)
      .in('product_flat_id', productFlatIds)
      .order('product_flat_id', { ascending: true })
      .order('created_at',     { ascending: true });

    if (error) throw error;
    return (data || []).map(mapVariant);
  }

  // ── Single variant lookup ─────────────────────────────────────────────────

  async findById(id: string): Promise<ProductVariant | null> {
    const { data, error } = await this.supabase
      .from('product_variant')
      .select(VARIANT_WITH_PARENT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapVariant(data) : null;
  }

  async findBySKU(sku: string): Promise<ProductVariant | null> {
    const { data, error } = await this.supabase
      .from('product_variant')
      .select(VARIANT_WITH_PARENT)
      .eq('sku', sku)
      .maybeSingle();

    if (error) throw error;
    return data ? mapVariant(data) : null;
  }

  async findByBarcode(barcode: string): Promise<ProductVariant | null> {
    const { data, error } = await this.supabase
      .from('product_variant')
      .select(VARIANT_WITH_PARENT)
      .eq('barcode', barcode)
      .maybeSingle();

    if (error) throw error;
    return data ? mapVariant(data) : null;
  }

  // ── Parent product CRUD ───────────────────────────────────────────────────

  async createParent(data: ParentProductFormData & { id?: string }): Promise<ParentProduct> {
    const lookups = await this.loadLookups();
    const dbData: Record<string, any> = {
      // Always supply an id — product_variant_flat has no auto-generate default in older Postgres versions.
      // Use the uuid package (already a project dependency) which works in all Node versions.
      id:              data.id || uuidv4(),
      name:            data.name,
      description:     data.description || '',
      purchase_price:  data.purchasePrice,
      selling_price:   data.sellingPrice,
      wholesale_price: data.wholesalePrice ?? null,
      tax_rate:        data.taxRate ?? 0,
      status:          data.status ?? 'Active',
    };

    // Resolve slug
    dbData.slug = this.slugify(`${data.name}-${Date.now().toString(36)}`);

    // Category / brand / unit as text labels
    if (data.categoryId) {
      dbData.category = lookups.categoryNameById.get(data.categoryId) ?? data.categoryId;
    }
    if (data.brandId) {
      dbData.brand = lookups.brandNameById.get(data.brandId) ?? null;
    }
    if (data.unitId) {
      const u = lookups.unitById.get(data.unitId);
      dbData.base_unit = u ? (u.shortName || u.name) : data.unitId;
    }

    const { data: created, error } = await this.supabase
      .from('product_variant_flat')
      .insert(dbData)
      .select(PARENT_COLS)
      .single();

    if (error) throw error;

    // Also insert into public.products so the website can see it
    await this.syncToPublicProducts(created);

    return mapParent(created);
  }

  async updateParent(id: string, data: Partial<ParentProductFormData>): Promise<ParentProduct> {
    const lookups = await this.loadLookups();
    const dbData: Record<string, any> = {};

    if (data.name !== undefined)           dbData.name            = data.name;
    if (data.description !== undefined)    dbData.description     = data.description;
    if (data.purchasePrice !== undefined)  dbData.purchase_price  = data.purchasePrice;
    if (data.sellingPrice !== undefined)   dbData.selling_price   = data.sellingPrice;
    if (data.wholesalePrice !== undefined) dbData.wholesale_price = data.wholesalePrice ?? null;
    if (data.taxRate !== undefined)        dbData.tax_rate        = data.taxRate;
    if (data.status !== undefined)         dbData.status          = data.status;

    if (data.categoryId) {
      dbData.category = lookups.categoryNameById.get(data.categoryId) ?? data.categoryId;
    }
    if (data.brandId !== undefined) {
      dbData.brand = data.brandId ? (lookups.brandNameById.get(data.brandId) ?? null) : null;
    }
    if (data.unitId) {
      const u = lookups.unitById.get(data.unitId);
      dbData.base_unit = u ? (u.shortName || u.name) : data.unitId;
    }

    const { data: updated, error } = await this.supabase
      .from('product_variant_flat')
      .update(dbData)
      .eq('id', id)
      .select(PARENT_COLS)
      .single();

    if (error) throw error;

    // Keep public.products in sync for the website
    await this.syncToPublicProducts(updated);

    return mapParent(updated);
  }

  async findParentById(id: string): Promise<ParentProduct | null> {
    const { data, error } = await this.supabase
      .from('product_variant_flat')
      .select(PARENT_COLS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapParent(data) : null;
  }

  async findAllParents(params: PaginationParams): Promise<PaginatedResponse<ParentProduct>> {
    const { search, page, limit } = params;
    const { from, to } = this.buildPagination(params);

    let query = this.supabase
      .from('product_variant_flat')
      .select(PARENT_COLS, { count: 'exact' })
      .neq('status', 'Archived');

    if (search) {
      query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    const mapped = (data || []).map(mapParent);
    return this.toPaginatedResponse(mapped, count || 0, page, limit);
  }

  async softDeleteParent(id: string): Promise<void> {
    await this.supabase
      .from('product_variant_flat')
      .update({ status: 'Archived' })
      .eq('id', id);

    // Also archive in public.products
    await this.supabase
      .from('products')
      .update({ status: 'Archived' })
      .eq('id', id);
  }

  // ── Variant CRUD ──────────────────────────────────────────────────────────

  async createVariant(data: ProductVariantFormData): Promise<ProductVariant> {
    const { data: created, error } = await this.supabase
      .from('product_variant')
      .insert({
        product_flat_id: data.productFlatId,
        variant_name:    data.variantName,
        sku:             data.sku,
        barcode:         data.barcode  || null,
        color:           data.color    || null,
        size:            data.size     || null,
        stock:           data.stock    ?? 0,
        minimum_stock:   data.minimumStock ?? 0,
        image:           data.image    || null,
      })
      .select(VARIANT_WITH_PARENT)
      .single();

    if (error) throw error;
    return mapVariant(created);
  }

  async updateVariant(
    id: string,
    data: Partial<ProductVariantFormData>
  ): Promise<ProductVariant> {
    const dbData: Record<string, any> = {};
    if (data.variantName  !== undefined) dbData.variant_name   = data.variantName;
    if (data.sku          !== undefined) dbData.sku            = data.sku;
    if (data.barcode      !== undefined) dbData.barcode        = data.barcode || null;
    if (data.color        !== undefined) dbData.color          = data.color   || null;
    if (data.size         !== undefined) dbData.size           = data.size    || null;
    if (data.stock        !== undefined) dbData.stock          = data.stock;
    if (data.minimumStock !== undefined) dbData.minimum_stock  = data.minimumStock;
    if (data.image        !== undefined) dbData.image          = data.image   || null;

    const { data: updated, error } = await this.supabase
      .from('product_variant')
      .update(dbData)
      .eq('id', id)
      .select(VARIANT_WITH_PARENT)
      .single();

    if (error) throw error;
    return mapVariant(updated);
  }

  async softDeleteVariant(id: string): Promise<void> {
    // Status column removed from product_variant — physically delete the variant row
    const { error } = await this.supabase
      .from('product_variant')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ── Stock operations ──────────────────────────────────────────────────────

  async updateStock(variantId: string, delta: number): Promise<ProductVariant> {
    const { data, error } = await this.supabase
      .rpc('increment_variant_stock', { p_variant_id: variantId, p_delta: delta })
      .single();

    if (error) throw error;
    // Fetch full row with parent join
    const full = await this.findById((data as any).id);
    return full!;
  }

  async adjustInventory(payload: {
    variantId: string;
    type: 'addition' | 'subtraction';
    quantity: number;
    reason: string;
    notes?: string;
    userId: string;
  }): Promise<any> {
    const { data, error } = await this.supabase
      .rpc('adjust_inventory_variant', { payload })
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // ── Low-stock / out-of-stock ──────────────────────────────────────────────

  async getLowStockVariants(): Promise<ProductVariant[]> {
    const { data, error } = await this.supabase
      .from('product_variant')
      .select(VARIANT_WITH_PARENT)
      .gt('stock', 0);

    if (error) throw error;
    return (data || [])
      .map(mapVariant)
      .filter((v) => v.minimumStock > 0 && v.stock <= v.minimumStock);
  }

  async getOutOfStockVariants(): Promise<ProductVariant[]> {
    const { data, error } = await this.supabase
      .from('product_variant')
      .select(VARIANT_WITH_PARENT)
      .eq('stock', 0);

    if (error) throw error;
    return (data || []).map(mapVariant);
  }

  /** Fetch all active variants (paginated internally to bypass 1000-row limit) */
  async getAllVariants(): Promise<ProductVariant[]> {
    const PAGE_SIZE = 1000;
    const all: any[] = [];
    let page = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from('product_variant')
        .select(VARIANT_WITH_PARENT)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      const rows = data || [];
      all.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      page++;
    }
    return all.map(mapVariant);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async loadLookups() {
    const [
      { data: categories },
      { data: brands },
      { data: units },
    ] = await Promise.all([
      this.supabase.from('categories').select('id, name'),
      this.supabase.from('brands').select('id, name').is('deletedAt', null),
      this.supabase.from('units').select('id, name, "shortName"').is('deletedAt', null),
    ]);

    const categoryNameById = new Map<string, string>();
    for (const c of categories || []) categoryNameById.set((c as any).id, (c as any).name);

    const brandNameById = new Map<string, string>();
    for (const b of brands || []) brandNameById.set((b as any).id, (b as any).name);

    const unitById = new Map<string, { name: string; shortName: string }>();
    for (const u of units || []) {
      unitById.set((u as any).id, { name: (u as any).name, shortName: (u as any).shortName });
    }

    return { categoryNameById, brandNameById, unitById };
  }

  /** Keep public.products in sync so the website always sees fresh data */
  private async syncToPublicProducts(pvf: any): Promise<void> {
    try {
      const row = {
        name:            pvf.name,
        slug:            pvf.slug,
        description:     pvf.description || '',
        category:        pvf.category    || '',
        brand:           pvf.brand       || null,
        unit:            pvf.base_unit   || null,
        purchase_price:  pvf.purchase_price,
        price:           pvf.selling_price,
        wholesale_price: pvf.wholesale_price ?? null,
        tax_rate:        pvf.tax_rate,
        image:           pvf.image  || '',
        images:          Array.isArray(pvf.images) ? pvf.images : [],
        sizes:           Array.isArray(pvf.sizes)  ? pvf.sizes  : ['OS'],
        status:          pvf.status,
      };

      // Try update first; if 0 rows updated, insert
      const { data: existing } = await this.supabase
        .from('products')
        .select('id')
        .eq('id', pvf.id)
        .maybeSingle();

      if (existing) {
        await this.supabase.from('products').update(row).eq('id', pvf.id);
      } else {
        await this.supabase.from('products').insert({ id: pvf.id, ...row, sku: pvf.id });
      }
    } catch {
      // Non-fatal — sync failure should not block the IMS operation
    }
  }
}

export default new ProductVariantRepository();
