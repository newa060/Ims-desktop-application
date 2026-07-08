import { Purchase } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import { PaginationParams, PaginatedResponse } from '../types';

export class PurchaseRepository extends BaseRepository<Purchase> {
  protected getModelName(): string {
    return 'purchase';
  }

  async findAllWithPagination(
    params: PaginationParams
  ): Promise<PaginatedResponse<Purchase>> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { purchaseNumber: { contains: search } },
        { supplier: { name: { contains: search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          supplier: true,
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
      this.prisma.purchase.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTodayPurchases(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.purchase.aggregate({
      where: {
        deletedAt: null,
        purchaseDate: {
          gte: today,
        },
      },
      _sum: {
        totalAmount: true,
      },
    });

    return result._sum.totalAmount || 0;
  }

  async getMonthlyPurchases(year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await this.prisma.purchase.aggregate({
      where: {
        deletedAt: null,
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        totalAmount: true,
      },
    });

    return result._sum.totalAmount || 0;
  }
}

export default new PurchaseRepository();
