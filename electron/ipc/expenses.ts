import { ipcMain } from 'electron';
import prisma from '../../src/database/client';
import logger from '../../src/utils/logger';

export const setupExpenseHandlers = () => {
  // expenses:getAll
  ipcMain.handle('expenses:getAll', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 20, search = '' } = params;
      const skip = (page - 1) * limit;
      const where: any = { deletedAt: null };
      if (search) {
        where.OR = [
          { description: { contains: search } },
          { reference: { contains: search } },
        ];
      }

      const [expenses, total] = await Promise.all([
        prisma.expense.findMany({
          where,
          include: {
            category: true,
            user: { select: { firstName: true, lastName: true } },
          },
          skip,
          take: limit,
          orderBy: { date: 'desc' },
        }),
        prisma.expense.count({ where }),
      ]);

      return {
        success: true,
        data: {
          data: expenses,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
      const expense = await prisma.expense.create({ data });
      return { success: true, data: expense };
    } catch (error) {
      logger.error('Create expense handler error:', error);
      return { success: false, error: 'Failed to create expense' };
    }
  });

  // expenses:update
  ipcMain.handle('expenses:update', async (_event, id: string, data: any) => {
    try {
      const expense = await prisma.expense.update({ where: { id }, data });
      return { success: true, data: expense };
    } catch (error) {
      logger.error('Update expense handler error:', error);
      return { success: false, error: 'Failed to update expense' };
    }
  });

  // expenses:delete
  ipcMain.handle('expenses:delete', async (_event, id: string) => {
    try {
      await prisma.expense.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      logger.error('Delete expense handler error:', error);
      return { success: false, error: 'Failed to delete expense' };
    }
  });

  // expenseCategories:getAll
  ipcMain.handle('expenseCategories:getAll', async () => {
    try {
      const categories = await prisma.expenseCategory.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
      return { success: true, data: categories };
    } catch (error) {
      logger.error('Get expense categories handler error:', error);
      return { success: false, error: 'Failed to fetch expense categories' };
    }
  });

  // expenseCategories:create
  ipcMain.handle('expenseCategories:create', async (_event, data: any) => {
    try {
      const category = await prisma.expenseCategory.create({ data });
      return { success: true, data: category };
    } catch (error) {
      logger.error('Create expense category handler error:', error);
      return { success: false, error: 'Failed to create expense category' };
    }
  });
};
