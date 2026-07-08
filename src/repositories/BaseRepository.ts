import { PrismaClient } from '@prisma/client';
import prisma from '../database/client';
import { PaginationParams, PaginatedResponse } from '../types';

export abstract class BaseRepository<T> {
  protected prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  protected async paginate<K>(
    query: any,
    params: PaginationParams
  ): Promise<PaginatedResponse<K>> {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      query.skip(skip).take(limit),
      this.prisma[this.getModelName()].count({
        where: query._query?.where,
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  protected abstract getModelName(): string;

  async findById(id: string): Promise<T | null> {
    return this.prisma[this.getModelName()].findUnique({
      where: { id },
    });
  }

  async findAll(): Promise<T[]> {
    return this.prisma[this.getModelName()].findMany({
      where: { deletedAt: null },
    });
  }

  async create(data: any): Promise<T> {
    return this.prisma[this.getModelName()].create({
      data,
    });
  }

  async update(id: string, data: any): Promise<T> {
    return this.prisma[this.getModelName()].update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<T> {
    return this.prisma[this.getModelName()].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async hardDelete(id: string): Promise<T> {
    return this.prisma[this.getModelName()].delete({
      where: { id },
    });
  }
}
