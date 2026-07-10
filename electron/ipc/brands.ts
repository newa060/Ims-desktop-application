import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

export const setupBrandHandlers = () => {
  ipcMain.handle('brands:getAll', async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .is('deletedAt', null)
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      logger.error('Get brands handler error:', error);
      return { success: false, error: 'Failed to fetch brands' };
    }
  });

  ipcMain.handle('brands:create', async (_event, data) => {
    try {
      const { data: brand, error } = await supabase
        .from('brands')
        .insert(data)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: brand };
    } catch (error) {
      logger.error('Create brand handler error:', error);
      return { success: false, error: 'Failed to create brand' };
    }
  });

  ipcMain.handle('brands:update', async (_event, id: string, data) => {
    try {
      const { data: brand, error } = await supabase
        .from('brands')
        .update(data)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: brand };
    } catch (error) {
      logger.error('Update brand handler error:', error);
      return { success: false, error: 'Failed to update brand' };
    }
  });

  ipcMain.handle('brands:delete', async (_event, id: string) => {
    try {
      const { error } = await supabase
        .from('brands')
        .update({ deletedAt: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      logger.error('Delete brand handler error:', error);
      return { success: false, error: 'Failed to delete brand' };
    }
  });
};
