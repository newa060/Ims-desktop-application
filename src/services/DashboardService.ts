import ProductRepository from '../repositories/ProductRepository';
import SaleRepository from '../repositories/SaleRepository';
import PurchaseRepository from '../repositories/PurchaseRepository';
import { DashboardStats } from '../types';
import prisma from '../database/client';
import logger from '../utils/logger';

export class DashboardService {
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const [
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        todaySales,
        todayPurchases,
        monthlySales,
        monthlyPurchases,
        totalCustomers,
        totalSuppliers,
      ] = await Promise.all([
        prisma.product.count({ where: { deletedAt: null } }),
        ProductRepository.getLowStockProducts().then((p) => p.length),
        ProductRepository.getOutOfStockProducts().then((p) => p.length),
        SaleRepository.getTodaySales(),
        PurchaseRepository.getTodayPurchases(),
        SaleRepository.getMonthlySales(currentYear, currentMonth),
        PurchaseRepository.getMonthlyPurchases(currentYear, currentMonth),
        prisma.customer.count({ where: { deletedAt: null } }),
        prisma.supplier.count({ where: { deletedAt: null } }),
      ]);

      // Calculate monthly profit (simple calculation: sales - purchases)
      const monthlyProfit = monthlySales - monthlyPurchases;

      return {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        todaySales,
        todayPurchases,
        monthlySales,
        monthlyPurchases,
        monthlyProfit,
        totalCustomers,
        totalSuppliers,
      };
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      throw new Error('Failed to fetch dashboard statistics');
    }
  }

  async getSalesChart(days: number = 7) {
    try {
      const salesData = [];
      const today = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const sales = await prisma.sale.aggregate({
          where: {
            deletedAt: null,
            status: 'completed',
            saleDate: {
              gte: date,
              lt: nextDate,
            },
          },
          _sum: {
            totalAmount: true,
          },
        });

        const purchases = await prisma.purchase.aggregate({
          where: {
            deletedAt: null,
            purchaseDate: {
              gte: date,
              lt: nextDate,
            },
          },
          _sum: {
            totalAmount: true,
          },
        });

        const totalSales = sales._sum.totalAmount || 0;
        const totalPurchases = purchases._sum.totalAmount || 0;

        salesData.push({
          date: date.toISOString().split('T')[0],
          sales: totalSales,
          profit: totalSales - totalPurchases,
        });
      }

      return salesData;
    } catch (error) {
      logger.error('Get sales chart error:', error);
      throw error;
    }
  }

  async getTopProducts(limit: number = 5) {
    try {
      const topProducts = await prisma.saleItem.groupBy({
        by: ['productId'],
        _sum: {
          quantity: true,
          totalAmount: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: limit,
      });

      const productsWithDetails = await Promise.all(
        topProducts.map(async (item) => {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
          });

          return {
            productId: item.productId,
            productName: product?.name || 'Unknown',
            quantitySold: item._sum.quantity || 0,
            totalRevenue: item._sum.totalAmount || 0,
          };
        })
      );

      return productsWithDetails;
    } catch (error) {
      logger.error('Get top products error:', error);
      throw error;
    }
  }

  async getRecentTransactions(limit: number = 10) {
    try {
      const [recentSales, recentPurchases] = await Promise.all([
        prisma.sale.findMany({
          where: { deletedAt: null },
          take: limit / 2,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            saleNumber: true,
            saleDate: true,
            totalAmount: true,
            status: true,
          },
        }),
        prisma.purchase.findMany({
          where: { deletedAt: null },
          take: limit / 2,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            purchaseNumber: true,
            purchaseDate: true,
            totalAmount: true,
            status: true,
          },
        }),
      ]);

      const transactions = [
        ...recentSales.map((s) => ({
          id: s.id,
          type: 'sale' as const,
          number: s.saleNumber,
          date: s.saleDate,
          amount: s.totalAmount,
          status: s.status,
        })),
        ...recentPurchases.map((p) => ({
          id: p.id,
          type: 'purchase' as const,
          number: p.purchaseNumber,
          date: p.purchaseDate,
          amount: p.totalAmount,
          status: p.status,
        })),
      ];

      return transactions.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
    } catch (error) {
      logger.error('Get recent transactions error:', error);
      throw error;
    }
  }
}

export default new DashboardService();
