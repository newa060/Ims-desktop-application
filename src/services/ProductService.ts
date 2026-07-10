import ProductRepository from '../repositories/ProductRepository';
import { Product, ProductFormData, PaginationParams } from '../types';
import { generateSKU } from '../utils/helpers';
import logger from '../utils/logger';

export class ProductService {
  async getProducts(params: PaginationParams) {
    try {
      return await ProductRepository.findAllWithPagination(params);
    } catch (error) {
      logger.error('Get products error:', error);
      throw new Error('Failed to fetch products');
    }
  }

  async getProductById(id: string): Promise<Product | null> {
    try {
      return await ProductRepository.findByIdWithDetails(id);
    } catch (error) {
      logger.error('Get product by ID error:', error);
      throw error;
    }
  }

  async getProductBySKU(sku: string): Promise<Product | null> {
    try {
      return await ProductRepository.findBySKU(sku);
    } catch (error) {
      logger.error('Get product by SKU error:', error);
      throw error;
    }
  }

  async getProductByBarcode(barcode: string): Promise<Product | null> {
    try {
      return await ProductRepository.findByBarcode(barcode);
    } catch (error) {
      logger.error('Get product by barcode error:', error);
      throw error;
    }
  }

  async createProduct(data: ProductFormData): Promise<Product> {
    try {
      // Generate SKU if not provided
      if (!data.sku) {
        data.sku = generateSKU('PRD');
      }

      const product = await ProductRepository.create(data);
      logger.info(`Product created: ${product.id}`);
      return product;
    } catch (error) {
      logger.error('Create product error:', error);
      throw new Error('Failed to create product');
    }
  }

  async updateProduct(id: string, data: Partial<ProductFormData>): Promise<Product> {
    try {
      const product = await ProductRepository.update(id, data);
      logger.info(`Product updated: ${id}`);
      return product;
    } catch (error) {
      logger.error('Update product error:', error);
      throw new Error('Failed to update product');
    }
  }

  async deleteProduct(id: string): Promise<Product> {
    try {
      const product = await ProductRepository.hardDelete(id);
      logger.info(`Product deleted: ${id}`);
      return product;
    } catch (error) {
      logger.error('Delete product error:', error);
      throw new Error('Failed to delete product');
    }
  }

  async getLowStockProducts(): Promise<Product[]> {
    try {
      return await ProductRepository.getLowStockProducts();
    } catch (error) {
      logger.error('Get low stock products error:', error);
      throw error;
    }
  }

  async getOutOfStockProducts(): Promise<Product[]> {
    try {
      return await ProductRepository.getOutOfStockProducts();
    } catch (error) {
      logger.error('Get out of stock products error:', error);
      throw error;
    }
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    try {
      const product = await ProductRepository.updateStock(id, quantity);
      logger.info(`Stock updated for product ${id}: ${quantity}`);
      return product;
    } catch (error) {
      logger.error('Update stock error:', error);
      throw new Error('Failed to update stock');
    }
  }
}

export default new ProductService();
