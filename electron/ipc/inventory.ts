import { ipcMain } from 'electron';
import prisma from '../../src/database/client';
import logger from '../../src/utils/logger';

export const setupInventoryHandlers = () => {
  // inventory:getHistory - paginated with optional productId filter
  ipcMain.handle('inventory:getHistory', async (_event, params: any = {}) => {
    try {
      const { productId, page = 1, limit = 20 } = params;
      const skip = (page - 1) * limit;
      const where: any = {};
      if (productId) where.productId = productId;

      const [history, total] = await Promise.all([
        prisma.inventoryHistory.findMany({
          where,
          include: {
            product: { select: { name: true, sku: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.inventoryHistory.count({ where }),
      ]);

      return {
        success: true,
        data: {
          data: history,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      };
    } catch (error) {
      logger.error('Get inventory history handler error:', error);
      return { success: false, error: 'Failed to fetch inventory history' };
    }
  });

  // inventory:adjust - create stock adjustment
  ipcMain.handle('inventory:adjust', async (_event, data: any) => {
    try {
      const { productId, type, quantity, reason, notes, userId } = data;

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error('Product not found');

        const change = type === 'addition' ? quantity : -quantity;
        const newStock = product.currentStock + change;
        if (newStock < 0) throw new Error('Insufficient stock');

        await tx.product.update({
          where: { id: productId },
          data: { currentStock: newStock },
        });

        const adj = await tx.stockAdjustment.create({
          data: { productId, type, quantity, reason, notes, userId },
        });

        await tx.inventoryHistory.create({
          data: {
            productId,
            type: 'adjustment',
            quantityChange: change,
            quantityBefore: product.currentStock,
            quantityAfter: newStock,
            reference: 'Stock Adjustment',
            referenceId: adj.id,
            notes: reason,
          },
        });

        return adj;
      });

      return { success: true, data: result };
    } catch (error) {
      logger.error('Inventory adjust handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to adjust stock',
      };
    }
  });

  // inventory:getLowStock
  ipcMain.handle('inventory:getLowStock', async () => {
    try {
      const products = await prisma.product.findMany({
        where: {
          deletedAt: null,
          status: 'active',
        },
        include: { category: true, unit: true },
        orderBy: { currentStock: 'asc' },
      });

      const lowStock = products.filter((p) => p.currentStock <= p.minimumStock);
      return { success: true, data: lowStock };
    } catch (error) {
      logger.error('Get low stock handler error:', error);
      return { success: false, error: 'Failed to fetch low stock products' };
    }
  });
};
