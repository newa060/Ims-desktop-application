import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import ProductRepository from '../../src/repositories/ProductRepository';
import logger from '../../src/utils/logger';

export const setupInventoryHandlers = () => {
  // inventory:getHistory - paginated with optional productId filter
  ipcMain.handle('inventory:getHistory', async (_event, params: any = {}) => {
    try {
      const { productId, page = 1, limit = 20 } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('inventory_history')
        .select('*, product:products(name, sku)', { count: 'exact' });

      if (productId) query = query.eq('productId', productId);

      const { data: history, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        success: true,
        data: {
          data: history,
          pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        },
      };
    } catch (error) {
      logger.error('Get inventory history handler error:', error);
      return { success: false, error: 'Failed to fetch inventory history' };
    }
  });

  // inventory:adjust - create stock adjustment
  // Done atomically via the adjust_inventory Postgres function (see Supabase
  // SQL schema) so the stock update and history entry can't diverge.
  ipcMain.handle('inventory:adjust', async (_event, data: any) => {
    try {
      const { data: result, error } = await supabase
        .rpc('adjust_inventory', { payload: data })
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

  // inventory:getLowStock — returns ALL products that need attention:
  // both low-stock (0 < stock ≤ minimum) and out-of-stock (stock = 0).
  ipcMain.handle('inventory:getLowStock', async () => {
    try {
      const [lowStock, outOfStock] = await Promise.all([
        ProductRepository.getLowStockProducts(),
        ProductRepository.getOutOfStockProducts(),
      ]);
      // Merge and deduplicate by id (a product can't be in both lists, but be safe)
      const seen = new Set<string>();
      const combined = [...outOfStock, ...lowStock].filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      return { success: true, data: combined };
    } catch (error) {
      logger.error('Get low stock handler error:', error);
      return { success: false, error: 'Failed to fetch low stock products' };
    }
  });
};
