import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

export const setupSupplierHandlers = () => {
  ipcMain.handle('suppliers:getAll', async (_event, params) => {
    try {
      const { page = 1, limit = 10, search } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('suppliers')
        .select('*', { count: 'exact' })
        .is('deletedAt', null);

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }

      const { data, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        success: true,
        data: {
          data,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
      };
    } catch (error) {
      logger.error('Get suppliers handler error:', error);
      return { success: false, error: 'Failed to fetch suppliers' };
    }
  });

  ipcMain.handle('suppliers:getById', async (_event, id: string) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      logger.error('Get supplier by ID handler error:', error);
      return { success: false, error: 'Failed to fetch supplier' };
    }
  });

  ipcMain.handle('suppliers:create', async (_event, data) => {
    try {
      const { data: supplier, error } = await supabase
        .from('suppliers')
        .insert(data)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: supplier };
    } catch (error) {
      logger.error('Create supplier handler error:', error);
      return { success: false, error: 'Failed to create supplier' };
    }
  });

  ipcMain.handle('suppliers:update', async (_event, id: string, data) => {
    try {
      const { data: supplier, error } = await supabase
        .from('suppliers')
        .update(data)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: supplier };
    } catch (error) {
      logger.error('Update supplier handler error:', error);
      return { success: false, error: 'Failed to update supplier' };
    }
  });

  ipcMain.handle('suppliers:delete', async (_event, id: string) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ deletedAt: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      logger.error('Delete supplier handler error:', error);
      return { success: false, error: 'Failed to delete supplier' };
    }
  });

  // suppliers:recordPayment - deduct a payment amount from supplier's outstanding balance
  ipcMain.handle('suppliers:recordPayment', async (_event, params: any) => {
    try {
      const { supplierId, amount } = params;

      // Fetch current supplier balance
      const { data: supplier, error: fetchError } = await supabase
        .from('suppliers')
        .select('balance')
        .eq('id', supplierId)
        .single();

      if (fetchError) throw fetchError;

      const currentBalance = Number((supplier as any).balance || 0);
      const paymentAmount = Number(amount);

      if (paymentAmount <= 0) throw new Error('Payment amount must be greater than 0');
      if (paymentAmount > currentBalance) throw new Error('Payment exceeds outstanding balance');

      const newBalance = currentBalance - paymentAmount;

      const { error: updateError } = await supabase
        .from('suppliers')
        .update({ balance: newBalance })
        .eq('id', supplierId);

      if (updateError) throw updateError;

      return { success: true, data: { newBalance } };
    } catch (error) {
      logger.error('Record supplier payment handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record payment',
      };
    }
  });
};
