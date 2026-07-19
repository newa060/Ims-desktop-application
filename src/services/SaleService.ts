import SaleRepository from '../repositories/SaleRepository';
import { Sale, PaginationParams } from '../types';
import logger from '../utils/logger';
import supabase from '../database/supabaseClient';

interface CreateSaleItem {
  productId: string;
  /** Required — references the specific variant being sold */
  variantId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
}

interface CreateSaleData {
  customerId?: string;
  items: CreateSaleItem[];
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
      // create_sale_v2 deducts stock from product_variants and writes
      // variant_id into sale_items + inventory_history — all atomically.
      const { data: sale, error } = await supabase
        .rpc('create_sale_v2', { payload: data })
        .single();

      if (error) throw new Error(error.message);

      logger.info(`Sale created: ${(sale as Sale).id}`);
      return sale as Sale;
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
