import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import ProductVariantService from '../../src/services/ProductVariantService';
import logger from '../../src/utils/logger';

export const setupVariantHandlers = () => {

  // ── Parent products (product_variant_flat) ──────────────────────────────

  ipcMain.handle('parents:getAll', async (_event, params) => {
    try {
      const data = await ProductVariantService.getParentProducts(params);
      return { success: true, data };
    } catch (error) {
      logger.error('parents:getAll error:', error);
      return { success: false, error: 'Failed to fetch parent products' };
    }
  });

  ipcMain.handle('parents:getById', async (_event, id: string) => {
    try {
      const data = await ProductVariantService.getParentById(id);
      return { success: true, data };
    } catch (error) {
      logger.error('parents:getById error:', error);
      return { success: false, error: 'Failed to fetch parent product' };
    }
  });

  ipcMain.handle('parents:create', async (_event, data) => {
    try {
      const parent = await ProductVariantService.createParent(data);
      return { success: true, data: parent };
    } catch (error) {
      logger.error('parents:create error:', error);
      return { success: false, error: 'Failed to create parent product' };
    }
  });

  ipcMain.handle('parents:update', async (_event, id: string, data) => {
    try {
      const parent = await ProductVariantService.updateParent(id, data);
      return { success: true, data: parent };
    } catch (error) {
      logger.error('parents:update error:', error);
      return { success: false, error: 'Failed to update parent product' };
    }
  });

  ipcMain.handle('parents:delete', async (_event, id: string) => {
    try {
      await ProductVariantService.deleteParent(id);
      return { success: true };
    } catch (error) {
      logger.error('parents:delete error:', error);
      return { success: false, error: 'Failed to archive parent product' };
    }
  });

  // ── Variants (product_variant) ──────────────────────────────────────────

  ipcMain.handle('variants:getAll', async (_event, params) => {
    try {
      const data = await ProductVariantService.getVariants(params);
      return { success: true, data };
    } catch (error) {
      logger.error('variants:getAll error:', error);
      return { success: false, error: 'Failed to fetch variants' };
    }
  });

  ipcMain.handle('variants:getByProduct', async (_event, productFlatId: string) => {
    try {
      const data = await ProductVariantService.getVariantsByProduct(productFlatId);
      return { success: true, data };
    } catch (error) {
      logger.error('variants:getByProduct error:', error);
      return { success: false, error: 'Failed to fetch variants for product' };
    }
  });

  // Batch variant fetch for multiple parent IDs — one Supabase query instead of N
  ipcMain.handle('variants:getByProductIds', async (_event, productFlatIds: string[]) => {
    try {
      const data = await ProductVariantService.getVariantsByProductIds(productFlatIds);
      return { success: true, data };
    } catch (error) {
      logger.error('variants:getByProductIds error:', error);
      return { success: false, error: 'Failed to fetch variants for products' };
    }
  });

  ipcMain.handle('variants:getById', async (_event, id: string) => {
    try {
      const data = await ProductVariantService.getVariantById(id);
      return { success: true, data };
    } catch (error) {
      logger.error('variants:getById error:', error);
      return { success: false, error: 'Failed to fetch variant' };
    }
  });

  ipcMain.handle('variants:searchByBarcode', async (_event, barcode: string) => {
    try {
      const data = await ProductVariantService.getVariantByBarcode(barcode);
      return { success: true, data };
    } catch (error) {
      logger.error('variants:searchByBarcode error:', error);
      return { success: false, error: 'Failed to search variant by barcode' };
    }
  });

  ipcMain.handle('variants:searchBySKU', async (_event, sku: string) => {
    try {
      const data = await ProductVariantService.getVariantBySKU(sku);
      return { success: true, data };
    } catch (error) {
      logger.error('variants:searchBySKU error:', error);
      return { success: false, error: 'Failed to search variant by SKU' };
    }
  });

  ipcMain.handle('variants:search', async (_event, query: string, limit = 25) => {
    try {
      const data = await ProductVariantService.searchVariants(query, limit);
      return { success: true, data };
    } catch (error) {
      logger.error('variants:search error:', error);
      return { success: false, error: 'Failed to search variants' };
    }
  });

  ipcMain.handle('variants:create', async (_event, data) => {
    try {
      const variant = await ProductVariantService.createVariant(data);
      return { success: true, data: variant };
    } catch (error) {
      logger.error('variants:create error:', error);
      return { success: false, error: 'Failed to create variant' };
    }
  });

  ipcMain.handle('variants:update', async (_event, id: string, data) => {
    try {
      const variant = await ProductVariantService.updateVariant(id, data);
      return { success: true, data: variant };
    } catch (error) {
      logger.error('variants:update error:', error);
      return { success: false, error: 'Failed to update variant' };
    }
  });

  ipcMain.handle('variants:delete', async (_event, id: string) => {
    try {
      await ProductVariantService.deleteVariant(id);
      return { success: true };
    } catch (error) {
      logger.error('variants:delete error:', error);
      return { success: false, error: 'Failed to archive variant' };
    }
  });

  // Out-of-stock variants — paginated, for the dashboard modal
  ipcMain.handle('variants:getOutOfStock', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 100 } = params;
      const from = (page - 1) * limit;
      const to   = from + limit - 1;

      const VARIANT_WITH_PARENT =
        'id, product_flat_id, sku, barcode, color, size, variant_name, stock, minimum_stock, created_at, updated_at' +
        ', parent:product_variant_flat(id, name, category, purchase_price, selling_price, tax_rate, status)';

      // Separate head count so joins never interfere with the exact total
      const [countRes, dataRes] = await Promise.all([
        supabase
          .from('product_variant')
          .select('*', { count: 'exact', head: true })
          .eq('stock', 0),
        supabase
          .from('product_variant')
          .select(VARIANT_WITH_PARENT)
          .eq('stock', 0)
          .order('created_at', { ascending: false })
          .range(from, to),
      ]);

      if (countRes.error) throw countRes.error;
      if (dataRes.error) throw dataRes.error;

      const total = countRes.count || 0;
      return {
        success: true,
        data: {
          data:       dataRes.data || [],
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      logger.error('variants:getOutOfStock error:', error);
      return { success: false, error: 'Failed to fetch out-of-stock variants' };
    }
  });

  // Low-stock variants only (out-of-stock uses variants:getOutOfStock — paginated)
  ipcMain.handle('variants:getLowStock', async () => {
    try {
      const lowStock = await ProductVariantService.getLowStockVariants();
      return { success: true, data: lowStock };
    } catch (error) {
      logger.error('variants:getLowStock error:', error);
      return { success: false, error: 'Failed to fetch low-stock variants' };
    }
  });
};
