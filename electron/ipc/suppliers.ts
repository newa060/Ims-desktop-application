import { ipcMain } from 'electron';
import prisma from '../../src/database/client';
import logger from '../../src/utils/logger';

export const setupSupplierHandlers = () => {
  ipcMain.handle('suppliers:getAll', async (_event, params) => {
    try {
      const { page = 1, limit = 10, search } = params;
      const skip = (page - 1) * limit;

      const where: any = { deletedAt: null };

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.supplier.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.supplier.count({ where }),
      ]);

      return {
        success: true,
        data: {
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
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
      const supplier = await prisma.supplier.findUnique({
        where: { id },
      });
      return { success: true, data: supplier };
    } catch (error) {
      logger.error('Get supplier by ID handler error:', error);
      return { success: false, error: 'Failed to fetch supplier' };
    }
  });

  ipcMain.handle('suppliers:create', async (_event, data) => {
    try {
      const supplier = await prisma.supplier.create({ data });
      return { success: true, data: supplier };
    } catch (error) {
      logger.error('Create supplier handler error:', error);
      return { success: false, error: 'Failed to create supplier' };
    }
  });

  ipcMain.handle('suppliers:update', async (_event, id: string, data) => {
    try {
      const supplier = await prisma.supplier.update({
        where: { id },
        data,
      });
      return { success: true, data: supplier };
    } catch (error) {
      logger.error('Update supplier handler error:', error);
      return { success: false, error: 'Failed to update supplier' };
    }
  });

  ipcMain.handle('suppliers:delete', async (_event, id: string) => {
    try {
      await prisma.supplier.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      logger.error('Delete supplier handler error:', error);
      return { success: false, error: 'Failed to delete supplier' };
    }
  });
};
