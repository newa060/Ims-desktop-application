import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

export const setupExpenseHandlers = () => {
  // expenses:getAll
  ipcMain.handle('expenses:getAll', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 20, search = '' } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('expenses')
        .select('*, category:expense_categories(*), user:users(firstName, lastName)', {
          count: 'exact',
        })
        .is('deletedAt', null);

      if (search) {
        query = query.or(
          `description.ilike.%${search}%,reference.ilike.%${search}%`
        );
      }

      const { data, error, count } = await query
        .order('date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        success: true,
        data: {
          data,
          pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        },
      };
    } catch (error) {
      logger.error('Get expenses handler error:', error);
      return { success: false, error: 'Failed to fetch expenses' };
    }
  });

  // expenses:create
  ipcMain.handle('expenses:create', async (_event, data: any) => {
    try {
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert(data)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: expense };
    } catch (error) {
      logger.error('Create expense handler error:', error);
      return { success: false, error: 'Failed to create expense' };
    }
  });

  // expenses:update
  ipcMain.handle('expenses:update', async (_event, id: string, data: any) => {
    try {
      const { data: expense, error } = await supabase
        .from('expenses')
        .update(data)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: expense };
    } catch (error) {
      logger.error('Update expense handler error:', error);
      return { success: false, error: 'Failed to update expense' };
    }
  });

  // expenses:delete
  ipcMain.handle('expenses:delete', async (_event, id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ deletedAt: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      logger.error('Delete expense handler error:', error);
      return { success: false, error: 'Failed to delete expense' };
    }
  });

  // expenseCategories:getAll
  ipcMain.handle('expenseCategories:getAll', async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .is('deletedAt', null)
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      logger.error('Get expense categories handler error:', error);
      return { success: false, error: 'Failed to fetch expense categories' };
    }
  });

  // expenseCategories:create
  ipcMain.handle('expenseCategories:create', async (_event, data: any) => {
    try {
      const { data: category, error } = await supabase
        .from('expense_categories')
        .insert(data)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: category };
    } catch (error) {
      logger.error('Create expense category handler error:', error);
      return { success: false, error: 'Failed to create expense category' };
    }
  });
};
