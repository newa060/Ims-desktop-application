import { BaseRepository } from './BaseRepository';
import { Purchase, PaginationParams, PaginatedResponse } from '../types';

const PURCHASE_SELECT =
  '*, supplier:suppliers(*), user:users(*), items:purchase_items(*, product:products(*))';

export class PurchaseRepository extends BaseRepository<Purchase> {
  protected getTableName(): string {
    return 'purchases';
  }

  async findAllWithPagination(
    params: PaginationParams
  ): Promise<PaginatedResponse<Purchase>> {
    const { search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const { page, limit, from, to } = this.buildPagination(params);

    let query = this.supabase
      .from(this.getTableName())
      .select(PURCHASE_SELECT, { count: 'exact' })
      .is('deletedAt', null);

    if (search) {
      query = query.ilike('purchaseNumber', `%${search}%`);
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (error) throw error;

    return this.toPaginatedResponse(data as Purchase[], count || 0, page, limit);
  }

  async getTodayPurchases(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select('totalAmount')
      .is('deletedAt', null)
      .gte('purchaseDate', today.toISOString());

    if (error) throw error;
    return (data || []).reduce((sum, p: any) => sum + (p.totalAmount || 0), 0);
  }

  async getMonthlyPurchases(year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select('totalAmount')
      .is('deletedAt', null)
      .gte('purchaseDate', startDate.toISOString())
      .lte('purchaseDate', endDate.toISOString());

    if (error) throw error;
    return (data || []).reduce((sum, p: any) => sum + (p.totalAmount || 0), 0);
  }
}

export default new PurchaseRepository();
