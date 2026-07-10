import { SupabaseClient } from '@supabase/supabase-js';
import supabase from '../database/supabaseClient';
import { PaginationParams, PaginatedResponse } from '../types';

export abstract class BaseRepository<T> {
  protected supabase: SupabaseClient;

  constructor() {
    this.supabase = supabase;
  }

  protected abstract getTableName(): string;

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as T | null;
  }

  async findAll(): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select('*')
      .is('deletedAt', null);

    if (error) throw error;
    return (data || []) as T[];
  }

  async create(data: any): Promise<T> {
    const { data: created, error } = await this.supabase
      .from(this.getTableName())
      .insert(data)
      .select('*')
      .single();

    if (error) throw error;
    return created as T;
  }

  async update(id: string, data: any): Promise<T> {
    const { data: updated, error } = await this.supabase
      .from(this.getTableName())
      .update(data)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated as T;
  }

  async softDelete(id: string): Promise<T> {
    const { data: updated, error } = await this.supabase
      .from(this.getTableName())
      .update({ deletedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return updated as T;
  }

  async hardDelete(id: string): Promise<T> {
    const { data: deleted, error } = await this.supabase
      .from(this.getTableName())
      .delete()
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return deleted as T;
  }

  protected buildPagination(params: PaginationParams) {
    const { page = 1, limit = 10 } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    return { page, limit, from, to };
  }

  protected toPaginatedResponse<K>(
    data: K[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResponse<K> {
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
