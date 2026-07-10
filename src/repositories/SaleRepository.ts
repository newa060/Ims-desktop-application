import { BaseRepository } from './BaseRepository';
import { Sale, PaginationParams, PaginatedResponse } from '../types';

const SALE_SELECT =
  '*, customer:customers(*), user:users(*), items:sale_items(*, product:products(*))';

export class SaleRepository extends BaseRepository<Sale> {
  protected getTableName(): string {
    return 'sales';
  }

  async findAllWithPagination(
    params: PaginationParams
  ): Promise<PaginatedResponse<Sale>> {
    const { search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const { page, limit, from, to } = this.buildPagination(params);

    let query = this.supabase
      .from(this.getTableName())
      .select(SALE_SELECT, { count: 'exact' })
      .is('deletedAt', null);

    if (search) {
      query = query.ilike('saleNumber', `%${search}%`);
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (error) throw error;

    return this.toPaginatedResponse(data as Sale[], count || 0, page, limit);
  }

  async findBySaleNumber(saleNumber: string): Promise<Sale | null> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select(SALE_SELECT)
      .eq('saleNumber', saleNumber)
      .maybeSingle();

    if (error) throw error;
    return data as Sale | null;
  }

  async getTodaySales(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select('totalAmount')
      .is('deletedAt', null)
      .eq('status', 'completed')
      .gte('saleDate', today.toISOString());

    if (error) throw error;
    return (data || []).reduce((sum, s: any) => sum + (s.totalAmount || 0), 0);
  }

  async getMonthlySales(year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select('totalAmount')
      .is('deletedAt', null)
      .eq('status', 'completed')
      .gte('saleDate', startDate.toISOString())
      .lte('saleDate', endDate.toISOString());

    if (error) throw error;
    return (data || []).reduce((sum, s: any) => sum + (s.totalAmount || 0), 0);
  }

  async getSalesReport(startDate: Date, endDate: Date): Promise<any[]> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select(
        '*, customer:customers(*), items:sale_items(*, product:products(*))'
      )
      .is('deletedAt', null)
      .gte('saleDate', startDate.toISOString())
      .lte('saleDate', endDate.toISOString());

    if (error) throw error;
    return data || [];
  }
}

export default new SaleRepository();
