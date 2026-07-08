import SaleRepository from '../repositories/SaleRepository';
import ProductRepository from '../repositories/ProductRepository';
import { Sale, SaleItem, PaginationParams } from '../types';
import { generateInvoiceNumber } from '../utils/helpers';
import logger from '../utils/logger';
import prisma from '../database/client';

interface CreateSaleData {
  customerId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discountAmount: number;
  }>;
  paymentMethod: string;
  paidAmount: number;
  discountAmount?: number;
  notes?: string;
  userId: string;
}

export class SaleService {
  async getSales(params: PaginationParams) {
    try {
      return await SaleRepository.findAllWithPagination(params);
    } catch (error) {
      logger.error('Get sales error:', error);
      throw new Error('Failed to fetch sales');
    }
  }

  async getSaleById(id: string): Promise<Sale | null> {
    try {
      return await SaleRepository.findById(id);
    } catch (error) {
      logger.error('Get sale by ID error:', error);
      throw error;
    }
  }

  async createSale(data: CreateSaleData): Promise<Sale> {
    try {
      // Calculate totals
      let subtotal = 0;
      let totalTax = 0;

      for (const item of data.items) {
        const itemSubtotal = item.quantity * item.unitPrice - item.discountAmount;
        const itemTax = (itemSubtotal * item.taxRate) / 100;
        subtotal += itemSubtotal;
        totalTax += itemTax;
      }

      const totalAmount = subtotal + totalTax - (data.discountAmount || 0);
      const changeAmount = data.paidAmount - totalAmount;

      // Create sale with items in a transaction
      const sale = await prisma.$transaction(async (tx) => {
        // Create the sale
        const newSale = await tx.sale.create({
          data: {
            saleNumber: generateInvoiceNumber('SALE'),
            customerId: data.customerId,
            userId: data.userId,
            subtotal,
            taxAmount: totalTax,
            discountAmount: data.discountAmount || 0,
            totalAmount,
            paidAmount: data.paidAmount,
            changeAmount,
            paymentMethod: data.paymentMethod,
            paymentStatus: 'paid',
            status: 'completed',
            notes: data.notes,
          },
        });

        // Create sale items and update product stock
        for (const item of data.items) {
          const itemTotalAmount =
            item.quantity * item.unitPrice -
            item.discountAmount +
            (item.quantity * item.unitPrice - item.discountAmount) * (item.taxRate / 100);

          // Create sale item
          await tx.saleItem.create({
            data: {
              saleId: newSale.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              taxAmount: (item.quantity * item.unitPrice * item.taxRate) / 100,
              discountAmount: item.discountAmount,
              totalAmount: itemTotalAmount,
            },
          });

          // Update product stock
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new Error(`Product ${item.productId} not found`);
          }

          if (product.currentStock < item.quantity) {
            throw new Error(`Insufficient stock for product ${product.name}`);
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: {
                decrement: item.quantity,
              },
            },
          });

          // Create inventory history
          await tx.inventoryHistory.create({
            data: {
              productId: item.productId,
              type: 'sale',
              quantityChange: -item.quantity,
              quantityBefore: product.currentStock,
              quantityAfter: product.currentStock - item.quantity,
              reference: 'Sale',
              referenceId: newSale.id,
            },
          });
        }

        return newSale;
      });

      logger.info(`Sale created: ${sale.id}`);
      return sale;
    } catch (error) {
      logger.error('Create sale error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create sale');
    }
  }

  async getTodaySales(): Promise<number> {
    try {
      return await SaleRepository.getTodaySales();
    } catch (error) {
      logger.error('Get today sales error:', error);
      throw error;
    }
  }

  async getMonthlySales(year: number, month: number): Promise<number> {
    try {
      return await SaleRepository.getMonthlySales(year, month);
    } catch (error) {
      logger.error('Get monthly sales error:', error);
      throw error;
    }
  }
}

export default new SaleService();
