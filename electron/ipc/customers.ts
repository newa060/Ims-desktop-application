import { ipcMain } from 'electron';
import prisma from '../../src/database/client';
import logger from '../../src/utils/logger';

export const setupCustomerHandlers = () => {
  ipcMain.handle('customers:getAll', async (_event, params) => {
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
        prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.customer.count({ where }),
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
      logger.error('Get customers handler error:', error);
      return { success: false, error: 'Failed to fetch customers' };
    }
  });

  ipcMain.handle('customers:getById', async (_event, id: string) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id },
      });
      return { success: true, data: customer };
    } catch (error) {
      logger.error('Get customer by ID handler error:', error);
      return { success: false, error: 'Failed to fetch customer' };
    }
  });

  ipcMain.handle('customers:create', async (_event, data) => {
    try {
      const customer = await prisma.customer.create({ data });
      return { success: true, data: customer };
    } catch (error) {
      logger.error('Create customer handler error:', error);
      return { success: false, error: 'Failed to create customer' };
    }
  });

  ipcMain.handle('customers:update', async (_event, id: string, data) => {
    try {
      const customer = await prisma.customer.update({
        where: { id },
        data,
      });
      return { success: true, data: customer };
    } catch (error) {
      logger.error('Update customer handler error:', error);
      return { success: false, error: 'Failed to update customer' };
    }
  });

  ipcMain.handle('customers:delete', async (_event, id: string) => {
    try {
      await prisma.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      logger.error('Delete customer handler error:', error);
      return { success: false, error: 'Failed to delete customer' };
    }
  });
};
