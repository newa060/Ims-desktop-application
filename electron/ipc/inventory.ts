import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import ProductVariantRepository from '../../src/repositories/ProductVariantRepository';
import logger from '../../src/utils/logger';
export const setupInventoryHandlers = () => {
  // inventory:getHistory — paginated, with optional variantId / productId filter
  ipcMain.handle('inventory:getHistory', async (_event, params: any = {}) => {
    try {
      const { productId, variantId, page = 1, limit = 20 } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('inventory_history')
        .select(
          '*, ' +
          'product:product_variant_flat(name), ' +
          'variant:product_variant(sku, variant_name, color, size)',
          { count: 'exact' }
        );

      if (variantId) {
        query = query.eq('variant_id', variantId);
      } else if (productId) {
        query = query.eq('"productId"', productId);
      }

      const { data: history, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        success: true,
        data: {
          data: history,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
      };
    } catch (error) {
      logger.error('Get inventory history handler error:', error);
      return { success: false, error: 'Failed to fetch inventory history' };
    }
  });

  // inventory:adjust — variant-level stock adjustment via adjust_inventory_variant RPC
  ipcMain.handle('inventory:adjust', async (_event, data: any) => {
    try {
      // Support both new (variantId) and old (productId) call shapes.
      let variantId = data.variantId;

      if (!variantId && data.productId) {
        const { data: variants, error: fetchErr } = await supabase
          .from('product_variant')
          .select('id')
          .eq('product_flat_id', data.productId)
          .neq('status', 'Archived')
          .order('created_at', { ascending: true })
          .limit(1);

        if (fetchErr) throw fetchErr;
        if (!variants || variants.length === 0) {
          throw new Error('No active variant found for this product');
        }
        variantId = variants[0].id;
      }

      if (!variantId) throw new Error('variantId is required');

      const { data: result, error } = await supabase
        .rpc('adjust_inventory_variant', {
          payload: { ...data, variantId },
        })
        .single();

      if (error) throw new Error(error.message);
      return { success: true, data: result };
    } catch (error) {
      logger.error('Inventory adjust handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to adjust stock',
      };
    }
  });

  // inventory:getLowStock — paginated stock alerts (fast; does not load all 13k+ rows)
  ipcMain.handle('inventory:getLowStock', async (_event, params: any = {}) => {
    try {
      const data = await ProductVariantRepository.getStockAlerts({
        page:  params.page  ?? 1,
        limit: params.limit ?? 50,
        type:  params.type  ?? 'out',
      });
      return { success: true, data };
    } catch (error) {
      logger.error('Get low stock handler error:', error);
      return { success: false, error: 'Failed to fetch low stock variants' };
    }
  });
};
