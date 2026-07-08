import { Sale } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import { PaginationParams, PaginatedResponse } from '../types';

export class SaleRepository extends BaseRepository<Sale> {
  protected getModelName(): string {
    return 'sale';
  }

  async findAllWithPagination(
    params: PaginationParams
  ): Promise<PaginatedResponse<Sale>> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { saleNumber: { contains: search } },
        { customer: { name: { contains: search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          customer: true,
          user: true,
          items: {
            include: {
              product: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findBySaleNumber(saleNumber: string): Promise<Sale | null> {
    return this.prisma.sale.findUnique({
      where: { saleNumber },
      include: {
        customer: true,
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async getTodaySales(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.sale.aggregate({
      where: {
        deletedAt: null,
        saleDate: {
          gte: today,
        },
        status: 'completed',
      },
      _sum: {
        totalAmount: true,
      },
    });

    return result._sum.totalAmount || 0;
  }

  async getMonthlySales(year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await this.prisma.sale.aggregate({
      where: {
        deletedAt: null,
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'completed',
      },
      _sum: {
        totalAmount: true,
      },
    });

    return result._sum.totalAmount || 0;
  }

  async getSalesReport(startDate: Date, endDate: Date): Promise<any[]> {
    return this.prisma.sale.findMany({
      where: {
        deletedAt: null,
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}

export default new SaleRepository();
