import { ipcMain } from 'electron';
import prisma from '../../src/database/client';
import logger from '../../src/utils/logger';

export const setupCategoryHandlers = () => {
  ipcMain.handle('categories:getAll', async () => {
    try {
      const categories = await prisma.category.findMany({
        where: { deletedAt: null },
        include: {
          parent: true,
          children: true,
        },
        orderBy: { name: 'asc' },
      });
      return { success: true, data: categories };
    } catch (error) {
      logger.error('Get categories handler error:', error);
      return { success: false, error: 'Failed to fetch categories' };
    }
  });

  ipcMain.handle('categories:create', async (_event, data) => {
    try {
      const category = await prisma.category.create({ data });
      return { success: true, data: category };
    } catch (error) {
      logger.error('Create category handler error:', error);
      return { success: false, error: 'Failed to create category' };
    }
  });

  ipcMain.handle('categories:update', async (_event, id: string, data) => {
    try {
      const category = await prisma.category.update({
        where: { id },
        data,
      });
      return { success: true, data: category };
    } catch (error) {
      logger.error('Update category handler error:', error);
      return { success: false, error: 'Failed to update category' };
    }
  });

  ipcMain.handle('categories:delete', async (_event, id: string) => {
    try {
      await prisma.category.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      logger.error('Delete category handler error:', error);
      return { success: false, error: 'Failed to delete category' };
    }
  });
};
