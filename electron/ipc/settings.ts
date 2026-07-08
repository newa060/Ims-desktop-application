import { ipcMain } from 'electron';
import prisma from '../../src/database/client';
import logger from '../../src/utils/logger';

export const setupSettingsHandlers = () => {
  ipcMain.handle('settings:getAll', async () => {
    try {
      const settings = await prisma.setting.findMany();
      return { success: true, data: settings };
    } catch (error) {
      logger.error('Get settings handler error:', error);
      return { success: false, error: 'Failed to fetch settings' };
    }
  });

  ipcMain.handle('settings:update', async (_event, key: string, value: string) => {
    try {
      const setting = await prisma.setting.update({
        where: { key },
        data: { value },
      });
      return { success: true, data: setting };
    } catch (error) {
      logger.error('Update setting handler error:', error);
      return { success: false, error: 'Failed to update setting' };
    }
  });
};
