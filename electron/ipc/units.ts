import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

export const setupUnitHandlers = () => {
  ipcMain.handle('units:getAll', async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .is('deletedAt', null)
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      logger.error('Get units handler error:', error);
      return { success: false, error: 'Failed to fetch units' };
    }
  });

  ipcMain.handle('units:create', async (_event, data) => {
    try {
      const { data: unit, error } = await supabase
        .from('units')
        .insert(data)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: unit };
    } catch (error) {
      logger.error('Create unit handler error:', error);
      return { success: false, error: 'Failed to create unit' };
    }
  });

  ipcMain.handle('units:update', async (_event, id: string, data) => {
    try {
      const { data: unit, error } = await supabase
        .from('units')
        .update(data)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: unit };
    } catch (error) {
      logger.error('Update unit handler error:', error);
      return { success: false, error: 'Failed to update unit' };
    }
  });

  ipcMain.handle('units:delete', async (_event, id: string) => {
    try {
      const { error } = await supabase
        .from('units')
        .update({ deletedAt: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      logger.error('Delete unit handler error:', error);
      return { success: false, error: 'Failed to delete unit' };
    }
  });
};
