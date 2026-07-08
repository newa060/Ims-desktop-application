import { ipcMain } from 'electron';
import prisma from '../../src/database/client';
import logger from '../../src/utils/logger';
import { generateInvoiceNumber } from '../../src/utils/helpers';

export const setupPurchaseHandlers = () => {
  // purchases:getAll - paginated list with supplier info
  ipcMain.handle('purchases:getAll', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 20, search = '' } = params;
      const skip = (page - 1) * limit;

      const where: any = { deletedAt: null };
      if (search) {
        where.OR = [
          { purchaseNumber: { contains: search } },
          { supplier: { name: { contains: search } } },
        ];
      }

      const [purchases, total] = await Promise.all([
        prisma.purchase.findMany({
          where,
          include: {
            supplier: true,
            user: { select: { firstName: true, lastName: true } },
            items: { include: { product: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.purchase.count({ where }),
      ]);

      return {
        success: true,
        data: {
          data: purchases,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      logger.error('Get purchases handler error:', error);
      return { success: false, error: 'Failed to fetch purchases' };
    }
  });

  // purchases:getById
  ipcMain.handle('purchases:getById', async (_event, id: string) => {
    try {
      const purchase = await prisma.purchase.findUnique({
        where: { id },
        include: {
          supplier: true,
          user: { select: { firstName: true, lastName: true } },
          items: { include: { product: { include: { unit: true } } } },
        },
      });
      return { success: true, data: purchase };
    } catch (error) {
      logger.error('Get purchase by ID handler error:', error);
      return { success: false, error: 'Failed to fetch purchase' };
    }
  });

  // purchases:create - creates purchase with items, updates stock & inventory history
  ipcMain.handle('purchases:create', async (_event, data: any) => {
    try {
      const { supplierId, userId, items, paymentMethod, paidAmount, shippingCost = 0, notes, dueDate } = data;

      let subtotal = 0;
      let totalTax = 0;
      for (const item of items) {
        const itemTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
        subtotal += itemTotal;
        totalTax += (itemTotal * (item.taxRate || 0)) / 100;
      }
      const totalAmount = subtotal + totalTax + shippingCost;
      const balanceAmount = totalAmount - (paidAmount || 0);
      const paymentStatus = balanceAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

      const purchase = await prisma.$transaction(async (tx) => {
        const newPurchase = await tx.purchase.create({
          data: {
            purchaseNumber: generateInvoiceNumber('PUR'),
            supplierId,
            userId,
            subtotal,
            taxAmount: totalTax,
            shippingCost,
            totalAmount,
            paidAmount: paidAmount || 0,
            balanceAmount,
            paymentMethod,
            paymentStatus,
            status: 'received',
            notes,
            dueDate: dueDate ? new Date(dueDate) : undefined,
          },
        });

        for (const item of items) {
          const itemTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
          await tx.purchaseItem.create({
            data: {
              purchaseId: newPurchase.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate || 0,
              taxAmount: (itemTotal * (item.taxRate || 0)) / 100,
              discountAmount: item.discountAmount || 0,
              totalAmount: itemTotal,
            },
          });

          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new Error(`Product ${item.productId} not found`);

          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } },
          });

          await tx.inventoryHistory.create({
            data: {
              productId: item.productId,
              type: 'purchase',
              quantityChange: item.quantity,
              quantityBefore: product.currentStock,
              quantityAfter: product.currentStock + item.quantity,
              reference: 'Purchase',
              referenceId: newPurchase.id,
              notes: `Purchase ${newPurchase.purchaseNumber}`,
            },
          });
        }

        return newPurchase;
      });

      logger.info(`Purchase created: ${purchase.id}`);
      return { success: true, data: purchase };
    } catch (error) {
      logger.error('Create purchase handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create purchase',
      };
    }
  });
};
