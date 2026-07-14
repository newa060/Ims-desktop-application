import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

export const setupPurchaseHandlers = () => {
  // purchases:getAll - paginated list with supplier info
  ipcMain.handle('purchases:getAll', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 20, search = '', supplierId } = params;
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

      if (supplierId) {
        query = query.eq('supplierId', supplierId);
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

  // purchases:getReturns - fetches all returns for a purchase
  ipcMain.handle('purchases:getReturns', async (_event, purchaseId: string) => {
    try {
      const { data: returns, error } = await supabase
        .from('inventory_history')
        .select('*, product:products(name, sku)')
        .eq('referenceId', purchaseId)
        .eq('reference', 'Purchase Return');

      if (error) throw error;
      return { success: true, data: returns };
    } catch (error) {
      logger.error('Get purchase returns handler error:', error);
      return { success: false, error: 'Failed to fetch returns' };
    }
  });

  // purchases:createReturn - records a return for a purchase item (damaged goods)
  ipcMain.handle('purchases:createReturn', async (_event, params: any) => {
    try {
      const { purchaseId, productId, quantity, notes, userId } = params;

      // 1. Decrement product stock atomically
      const { data: updatedProduct, error: rpcError } = await supabase
        .rpc('increment_product_stock', {
          p_product_id: productId,
          p_delta: -Number(quantity),
        })
        .single();

      if (rpcError) throw rpcError;

      // 2. Insert record into inventory_history
      const { error: insertError } = await supabase
        .from('inventory_history')
        .insert({
          productId,
          type: 'return',
          quantityChange: -Number(quantity),
          quantityBefore: (updatedProduct as any).stock + Number(quantity),
          quantityAfter: (updatedProduct as any).stock,
          reference: 'Purchase Return',
          referenceId: purchaseId,
          notes: notes || 'Damaged goods returned to supplier',
        });

      if (insertError) throw insertError;

      return { success: true };
    } catch (error) {
      logger.error('Create purchase return handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process return',
      };
    }
  });
};
