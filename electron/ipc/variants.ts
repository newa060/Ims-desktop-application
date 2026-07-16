import { ipcMain } from 'electron';
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

  // ── Stock / low-stock ────────────────────────────────────────────────────

  ipcMain.handle('variants:getLowStock', async () => {
    try {
      const [lowStock, outOfStock] = await Promise.all([
        ProductVariantService.getLowStockVariants(),
        ProductVariantService.getOutOfStockVariants(),
      ]);
      const seen = new Set<string>();
      const combined = [...outOfStock, ...lowStock].filter((v) => {
        if (seen.has(v.id)) return false;
        seen.add(v.id);
        return true;
      });
      return { success: true, data: combined };
    } catch (error) {
      logger.error('variants:getLowStock error:', error);
      return { success: false, error: 'Failed to fetch low-stock variants' };
    }
  });
};
