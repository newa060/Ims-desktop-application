import { Product } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import { PaginationParams, PaginatedResponse } from '../types';

export class ProductRepository extends BaseRepository<Product> {
  protected getModelName(): string {
    return 'product';
  }

  async findAllWithPagination(
    params: PaginationParams
  ): Promise<PaginatedResponse<Product>> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          brand: true,
          unit: true,
          images: true,
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findBySKU(sku: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { sku },
      include: {
        category: true,
        brand: true,
        unit: true,
        images: true,
        variants: true,
      },
    });
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { barcode },
      include: {
        category: true,
        brand: true,
        unit: true,
        images: true,
      },
    });
  }

  async getLowStockProducts(minimumThreshold?: number): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          { currentStock: 0 },
          {
            currentStock: {
              lte: this.prisma.product.fields.minimumStock,
            },
          },
        ],
      },
      include: {
        category: true,
        brand: true,
        unit: true,
      },
    });
  }

  async getOutOfStockProducts(): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        currentStock: 0,
      },
      include: {
        category: true,
        brand: true,
        unit: true,
      },
    });
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data: {
        currentStock: {
          increment: quantity,
        },
      },
    });
  }

  async findByIdWithDetails(id: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        unit: true,
        images: true,
        variants: true,
      },
    });
  }
}

export default new ProductRepository();
