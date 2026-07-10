import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

export const setupPurchaseHandlers = () => {
  // purchases:getAll - paginated list with supplier info
  ipcMain.handle('purchases:getAll', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 20, search = '' } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('purchases')
        .select(
          '*, supplier:suppliers(*), user:users(firstName, lastName), items:purchase_items(*, product:products(*))',
          { count: 'exact' }
        )
        .is('deletedAt', null);

      if (search) {
        query = query.ilike('purchaseNumber', `%${search}%`);
      }

      const { data: purchases, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        success: true,
        data: {
          data: purchases,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
      };
    } catch (error) {
      logger.error('Get purchases handler error:', error);
      return { success: false, error: 'Failed to fetch purchases' };
    }
  });

  // purchases:getById
  ipcMain.handle('purchases:getById', async (_event, id: string) => {
    try {
      const { data: purchase, error } = await supabase
        .from('purchases')
        .select(
          '*, supplier:suppliers(*), user:users(firstName, lastName), items:purchase_items(*, product:products(*))'
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data: purchase };
    } catch (error) {
      logger.error('Get purchase by ID handler error:', error);
      return { success: false, error: 'Failed to fetch purchase' };
    }
  });

  // purchases:create - creates purchase with items, updates stock & inventory history
  // Done atomically via the create_purchase Postgres function (see Supabase SQL
  // schema) since PostgREST has no client-side multi-statement transactions.
  ipcMain.handle('purchases:create', async (_event, data: any) => {
    try {
      const { data: purchase, error } = await supabase
        .rpc('create_purchase', { payload: data })
        .single();

      if (error) throw new Error(error.message);

      logger.info(`Purchase created: ${(purchase as any).id}`);
      return { success: true, data: purchase };
    } catch (error) {
      logger.error('Create purchase handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create purchase',
      };
    }
  });
};
