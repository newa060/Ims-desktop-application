import { ipcMain } from 'electron';
import prisma from '../../src/database/client';
import logger from '../../src/utils/logger';

export const setupBrandHandlers = () => {
  ipcMain.handle('brands:getAll', async () => {
    try {
      const brands = await prisma.brand.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
      return { success: true, data: brands };
    } catch (error) {
      logger.error('Get brands handler error:', error);
      return { success: false, error: 'Failed to fetch brands' };
    }
  });

  ipcMain.handle('brands:create', async (_event, data) => {
    try {
      const brand = await prisma.brand.create({ data });
      return { success: true, data: brand };
    } catch (error) {
      logger.error('Create brand handler error:', error);
      return { success: false, error: 'Failed to create brand' };
    }
  });

  ipcMain.handle('brands:update', async (_event, id: string, data) => {
    try {
      const brand = await prisma.brand.update({
        where: { id },
        data,
      });
      return { success: true, data: brand };
    } catch (error) {
      logger.error('Update brand handler error:', error);
      return { success: false, error: 'Failed to update brand' };
    }
  });

  ipcMain.handle('brands:delete', async (_event, id: string) => {
    try {
      await prisma.brand.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      logger.error('Delete brand handler error:', error);
      return { success: false, error: 'Failed to delete brand' };
    }
  });
};
