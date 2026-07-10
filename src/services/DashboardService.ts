import ProductRepository from '../repositories/ProductRepository';
import SaleRepository from '../repositories/SaleRepository';
import PurchaseRepository from '../repositories/PurchaseRepository';
import { DashboardStats } from '../types';
import supabase from '../database/supabaseClient';
import logger from '../utils/logger';

const countActive = async (table: string): Promise<number> => {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .is('deletedAt', null);

  if (error) throw error;
  return count || 0;
};

// Count all non-archived products so the Total Products KPI reflects the
// live catalog (Active + Draft) but excludes anything soft-deleted from the IMS.
const countAllProducts = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'Archived');

  if (error) throw error;
  return count || 0;
};

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
        countAllProducts(),
        ProductRepository.getLowStockProducts().then((p) => p.length),
        ProductRepository.getOutOfStockProducts().then((p) => p.length),
        SaleRepository.getTodaySales(),
        PurchaseRepository.getTodayPurchases(),
        SaleRepository.getMonthlySales(currentYear, currentMonth),
        PurchaseRepository.getMonthlyPurchases(currentYear, currentMonth),
        countActive('customers'),
        countActive('suppliers'),
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
      const today = new Date();
      const rangeStart = new Date(today);
      rangeStart.setDate(rangeStart.getDate() - (days - 1));
      rangeStart.setHours(0, 0, 0, 0);

      const [{ data: sales, error: salesError }, { data: purchases, error: purchasesError }] =
        await Promise.all([
          supabase
            .from('sales')
            .select('totalAmount, saleDate')
            .is('deletedAt', null)
            .eq('status', 'completed')
            .gte('saleDate', rangeStart.toISOString()),
          supabase
            .from('purchases')
            .select('totalAmount, purchaseDate')
            .is('deletedAt', null)
            .gte('purchaseDate', rangeStart.toISOString()),
        ]);

      if (salesError) throw salesError;
      if (purchasesError) throw purchasesError;

      const salesByDay = new Map<string, number>();
      for (const s of sales || []) {
        const key = (s as any).saleDate.split('T')[0];
        salesByDay.set(key, (salesByDay.get(key) || 0) + (s as any).totalAmount);
      }

      const purchasesByDay = new Map<string, number>();
      for (const p of purchases || []) {
        const key = (p as any).purchaseDate.split('T')[0];
        purchasesByDay.set(key, (purchasesByDay.get(key) || 0) + (p as any).totalAmount);
      }

      const salesData = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const key = date.toISOString().split('T')[0];

        const totalSales = salesByDay.get(key) || 0;
        const totalPurchases = purchasesByDay.get(key) || 0;

        salesData.push({
          date: key,
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
      const { data, error } = await supabase.rpc('get_top_products', {
        limit_count: limit,
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Get top products error:', error);
      throw error;
    }
  }

  async getRecentTransactions(limit: number = 10) {
    try {
      const half = Math.ceil(limit / 2);

      const [{ data: recentSales, error: salesError }, { data: recentPurchases, error: purchasesError }] =
        await Promise.all([
          supabase
            .from('sales')
            .select('id, saleNumber, saleDate, totalAmount, status')
            .is('deletedAt', null)
            .order('createdAt', { ascending: false })
            .limit(half),
          supabase
            .from('purchases')
            .select('id, purchaseNumber, purchaseDate, totalAmount, status')
            .is('deletedAt', null)
            .order('createdAt', { ascending: false })
            .limit(half),
        ]);

      if (salesError) throw salesError;
      if (purchasesError) throw purchasesError;

      const transactions = [
        ...(recentSales || []).map((s: any) => ({
          id: s.id,
          type: 'sale' as const,
          number: s.saleNumber,
          date: new Date(s.saleDate),
          amount: s.totalAmount,
          status: s.status,
        })),
        ...(recentPurchases || []).map((p: any) => ({
          id: p.id,
          type: 'purchase' as const,
          number: p.purchaseNumber,
          date: new Date(p.purchaseDate),
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
