import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

export const setupSettingsHandlers = () => {
  ipcMain.handle('settings:getAll', async () => {
    try {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      logger.error('Get settings handler error:', error);
      return { success: false, error: 'Failed to fetch settings' };
    }
  });

  ipcMain.handle('settings:update', async (_event, key: string, value: string) => {
    try {
      const { data: setting, error } = await supabase
        .from('settings')
        .update({ value })
        .eq('key', key)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: setting };
    } catch (error) {
      logger.error('Update setting handler error:', error);
      return { success: false, error: 'Failed to update setting' };
    }
  });
};
