import { ipcMain } from 'electron';
import prisma from '../../src/database/client';
import logger from '../../src/utils/logger';

export const setupUnitHandlers = () => {
  ipcMain.handle('units:getAll', async () => {
    try {
      const units = await prisma.unit.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
      return { success: true, data: units };
    } catch (error) {
      logger.error('Get units handler error:', error);
      return { success: false, error: 'Failed to fetch units' };
    }
  });

  ipcMain.handle('units:create', async (_event, data) => {
    try {
      const unit = await prisma.unit.create({ data });
      return { success: true, data: unit };
    } catch (error) {
      logger.error('Create unit handler error:', error);
      return { success: false, error: 'Failed to create unit' };
    }
  });

  ipcMain.handle('units:update', async (_event, id: string, data) => {
    try {
      const unit = await prisma.unit.update({
        where: { id },
        data,
      });
      return { success: true, data: unit };
    } catch (error) {
      logger.error('Update unit handler error:', error);
      return { success: false, error: 'Failed to update unit' };
    }
  });

  ipcMain.handle('units:delete', async (_event, id: string) => {
    try {
      await prisma.unit.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      logger.error('Delete unit handler error:', error);
      return { success: false, error: 'Failed to delete unit' };
    }
  });
};
