import { BaseRepository } from './BaseRepository';
import { Product, PaginationParams, PaginatedResponse } from '../types';

// `products` is the SAME table the AESTHETE website reads/writes (that's
// the whole point — one shared catalog/stock, no separate desktop copy).
// Its columns (snake_case, plain-text category/brand/unit, single `price`/
// `stock`) predate this app and must not be renamed. Everything below
// translates between that shape and the camelCase shape the rest of this
// app (front-end included) already expects, so no other file has to change.

const READ_COLUMNS =
  'id, name, sku, barcode, description, category, brand, unit, status, image, images, sizes, slug, ' +
  'purchasePrice:purchase_price, sellingPrice:price, wholesalePrice:wholesale_price, ' +
  'taxRate:tax_rate, minimumStock:minimum_stock, currentStock:stock, ' +
  'createdAt:created_at, updatedAt:updated_at';

const SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  currentStock: 'stock',
  sellingPrice: 'price',
  minimumStock: 'minimum_stock',
};

// Website status enum ('Active'/'Draft'/'Archived') <-> IMS status
// ('active'/'inactive'/'discontinued'). Bijective so it round-trips cleanly.
const STATUS_TO_DB: Record<string, string> = {
  active: 'Active',
  inactive: 'Draft',
  discontinued: 'Archived',
};
const STATUS_FROM_DB: Record<string, string> = {
  Active: 'active',
  Draft: 'inactive',
  Archived: 'discontinued',
};

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

interface LookupMaps {
  categoryIdByName: Map<string, string>;
  categoryNameById: Map<string, string>;
  brandIdByName: Map<string, string>;
  brandNameById: Map<string, string>;
  unitById: Map<string, { name: string; shortName: string }>;
}

export class ProductRepository extends BaseRepository<Product> {
  protected getTableName(): string {
    return 'products';
  }

  private async loadLookups(): Promise<LookupMaps> {
    const [{ data: categories, error: catError }, { data: brands, error: brandError }, { data: units, error: unitError }] =
      await Promise.all([
        this.supabase.from('categories').select('id, name'),
        this.supabase.from('brands').select('id, name').is('deletedAt', null),
        this.supabase.from('units').select('id, name, "shortName"').is('deletedAt', null),
      ]);

    if (catError) throw catError;
    if (brandError) throw brandError;
    if (unitError) throw unitError;

    const categoryIdByName = new Map<string, string>();
    const categoryNameById = new Map<string, string>();
    for (const c of categories || []) {
      categoryIdByName.set((c as any).name, (c as any).id);
      categoryNameById.set((c as any).id, (c as any).name);
    }

    const brandIdByName = new Map<string, string>();
    const brandNameById = new Map<string, string>();
    for (const b of brands || []) {
      brandIdByName.set((b as any).name, (b as any).id);
      brandNameById.set((b as any).id, (b as any).name);
    }

    const unitById = new Map<string, { name: string; shortName: string }>();
    for (const u of units || []) {
      unitById.set((u as any).id, { name: (u as any).name, shortName: (u as any).shortName });
    }

    return { categoryIdByName, categoryNameById, brandIdByName, brandNameById, unitById };
  }

  private async toAppShape(row: any): Promise<Product> {
    const lookups = await this.loadLookups();
    return this.mapRow(row, lookups);
  }

  private mapRow(row: any, lookups: LookupMaps): Product {
    return {
      ...row,
      status: STATUS_FROM_DB[row.status] || row.status,
      category: row.category
        ? { id: lookups.categoryIdByName.get(row.category) || '', name: row.category }
        : undefined,
      brand: row.brand
        ? { id: lookups.brandIdByName.get(row.brand) || '', name: row.brand }
        : undefined,
      unit: row.unit ? { id: '', name: row.unit, shortName: row.unit } : undefined,
    } as Product;
  }

  async findAllWithPagination(
    params: PaginationParams
  ): Promise<PaginatedResponse<Product>> {
    const { search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const { page, limit, from, to } = this.buildPagination(params);

    let query = this.supabase
      .from(this.getTableName())
      .select(READ_COLUMNS, { count: 'exact' });

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`
      );
    }

    const sortColumn = SORT_COLUMN_MAP[sortBy] || sortBy;
    const { data, error, count } = await query
      .order(sortColumn, { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (error) throw error;

    const lookups = await this.loadLookups();
    const mapped = (data || []).map((row) => this.mapRow(row, lookups));

    return this.toPaginatedResponse(mapped, count || 0, page, limit);
  }

  async findBySKU(sku: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select(READ_COLUMNS)
      .eq('sku', sku)
      .maybeSingle();

    if (error) throw error;
    return data ? this.toAppShape(data) : null;
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select(READ_COLUMNS)
      .eq('barcode', barcode)
      .maybeSingle();

    if (error) throw error;
    return data ? this.toAppShape(data) : null;
  }

  async getLowStockProducts(): Promise<Product[]> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select(READ_COLUMNS)
      .eq('status', 'Active');

    if (error) throw error;
    const lookups = await this.loadLookups();
    return (data || [])
      .map((row) => this.mapRow(row, lookups))
      .filter((p) => p.currentStock <= p.minimumStock);
  }

  async getOutOfStockProducts(): Promise<Product[]> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select(READ_COLUMNS)
      .eq('stock', 0);

    if (error) throw error;
    const lookups = await this.loadLookups();
    return (data || []).map((row) => this.mapRow(row, lookups));
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const { data, error } = await this.supabase
      .rpc('increment_product_stock', { p_product_id: id, p_delta: quantity })
      .single();

    if (error) throw error;
    return this.toAppShape(data);
  }

  async findByIdWithDetails(id: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select(READ_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? this.toAppShape(data) : null;
  }

  async findById(id: string): Promise<Product | null> {
    return this.findByIdWithDetails(id);
  }

  async findAll(): Promise<Product[]> {
    const { data, error } = await this.supabase.from(this.getTableName()).select(READ_COLUMNS);
    if (error) throw error;
    const lookups = await this.loadLookups();
    return (data || []).map((row) => this.mapRow(row, lookups));
  }

  private async toDbShape(data: any, lookups: LookupMaps): Promise<Record<string, any>> {
    const dbData: Record<string, any> = {};

    if (data.name !== undefined) dbData.name = data.name;
    if (data.sku !== undefined) dbData.sku = data.sku;
    if (data.barcode !== undefined) dbData.barcode = data.barcode || null;
    if (data.description !== undefined) dbData.description = data.description || '';
    if (data.purchasePrice !== undefined) dbData.purchase_price = data.purchasePrice;
    if (data.sellingPrice !== undefined) dbData.price = Math.round(data.sellingPrice);
    if (data.wholesalePrice !== undefined) dbData.wholesale_price = data.wholesalePrice;
    if (data.taxRate !== undefined) dbData.tax_rate = data.taxRate;
    if (data.minimumStock !== undefined) dbData.minimum_stock = data.minimumStock;
    if (data.currentStock !== undefined) dbData.stock = data.currentStock;
    if (data.status !== undefined) dbData.status = STATUS_TO_DB[data.status] || 'Active';

    if (data.categoryId !== undefined) {
      const name = lookups.categoryNameById.get(data.categoryId);
      if (!name) throw new Error('Unknown category');
      dbData.category = name;
    }
    if (data.brandId !== undefined) {
      dbData.brand = data.brandId ? lookups.brandNameById.get(data.brandId) || null : null;
    }
    if (data.unitId !== undefined) {
      const unit = lookups.unitById.get(data.unitId);
      if (!unit) throw new Error('Unknown unit');
      dbData.unit = unit.shortName || unit.name;
    }

    return dbData;
  }

  async create(data: any): Promise<Product> {
    const lookups = await this.loadLookups();
    const dbData = await this.toDbShape(data, lookups);

    dbData.slug = slugify(`${data.name}-${data.sku}`);
    dbData.image = dbData.image || '';
    dbData.images = [];
    dbData.sizes = ['OS'];
    dbData.description = dbData.description || '';

    const { data: created, error } = await this.supabase
      .from(this.getTableName())
      .insert(dbData)
      .select(READ_COLUMNS)
      .single();

    if (error) throw error;
    return this.mapRow(created, lookups);
  }

  async update(id: string, data: any): Promise<Product> {
    const lookups = await this.loadLookups();
    const dbData = await this.toDbShape(data, lookups);

    const { data: updated, error } = await this.supabase
      .from(this.getTableName())
      .update(dbData)
      .eq('id', id)
      .select(READ_COLUMNS)
      .single();

    if (error) throw error;
    return this.mapRow(updated, lookups);
  }

  // The shared `products` table has no soft-delete column (the website
  // uses `status` for that) — "deleting" a product from the IMS side just
  // archives it instead of removing/hiding a row the storefront also reads.
  async softDelete(id: string): Promise<Product> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .update({ status: 'Archived' })
      .eq('id', id)
      .select(READ_COLUMNS)
      .single();

    if (error) throw error;
    return this.toAppShape(data);
  }

  async hardDelete(id: string): Promise<Product> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .delete()
      .eq('id', id)
      .select(READ_COLUMNS)
      .single();

    if (error) throw error;
    return this.toAppShape(data);
  }
}

export default new ProductRepository();
