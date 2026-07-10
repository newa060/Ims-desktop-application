import { BaseRepository } from './BaseRepository';
import { User, PaginationParams, PaginatedResponse } from '../types';

const USER_WITH_ROLE_SELECT = '*, role:roles(*, permissions(*))';

export class UserRepository extends BaseRepository<User> {
  protected getTableName(): string {
    return 'users';
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select(USER_WITH_ROLE_SELECT)
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    return data as User | null;
  }

  async findAllWithPagination(
    params: PaginationParams
  ): Promise<PaginatedResponse<User>> {
    const { search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const { page, limit, from, to } = this.buildPagination(params);

    let query = this.supabase
      .from(this.getTableName())
      .select('*, role:roles(*)', { count: 'exact' })
      .is('deletedAt', null);

    if (search) {
      query = query.or(
        `firstName.ilike.%${search}%,lastName.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (error) throw error;

    return this.toPaginatedResponse(data as User[], count || 0, page, limit);
  }

  async updateLastLogin(id: string): Promise<User> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .update({ lastLogin: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as User;
  }
}

export default new UserRepository();
