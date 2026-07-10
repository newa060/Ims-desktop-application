import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

export const setupCustomerHandlers = () => {
  ipcMain.handle('customers:getAll', async (_event, params) => {
    try {
      const { page = 1, limit = 10, search } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('customers')
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
      logger.error('Get customers handler error:', error);
      return { success: false, error: 'Failed to fetch customers' };
    }
  });

  ipcMain.handle('customers:getById', async (_event, id: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      logger.error('Get customer by ID handler error:', error);
      return { success: false, error: 'Failed to fetch customer' };
    }
  });

  ipcMain.handle('customers:create', async (_event, data) => {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .insert(data)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: customer };
    } catch (error) {
      logger.error('Create customer handler error:', error);
      return { success: false, error: 'Failed to create customer' };
    }
  });

  ipcMain.handle('customers:update', async (_event, id: string, data) => {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .update(data)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: customer };
    } catch (error) {
      logger.error('Update customer handler error:', error);
      return { success: false, error: 'Failed to update customer' };
    }
  });

  ipcMain.handle('customers:delete', async (_event, id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ deletedAt: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      logger.error('Delete customer handler error:', error);
      return { success: false, error: 'Failed to delete customer' };
    }
  });
};
