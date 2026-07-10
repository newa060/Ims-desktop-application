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
};
