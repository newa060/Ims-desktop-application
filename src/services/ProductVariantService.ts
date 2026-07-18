import ProductVariantRepository from '../repositories/ProductVariantRepository';
import {
  ProductVariant,
  ParentProduct,
  ProductVariantFormData,
  ParentProductFormData,
  PaginationParams,
  PaginatedResponse,
} from '../types';
import logger from '../utils/logger';

export class ProductVariantService {

  // ── Parent products (product_variant_flat) ─────────────────────────────────

  async getParentProducts(params: PaginationParams): Promise<PaginatedResponse<ParentProduct>> {
    try {
      return await ProductVariantRepository.findAllParents(params);
    } catch (error) {
      logger.error('getParentProducts error:', error);
      throw new Error('Failed to fetch parent products');
    }
  }

  async getParentById(id: string): Promise<ParentProduct | null> {
    try {
      return await ProductVariantRepository.findParentById(id);
    } catch (error) {
      logger.error('getParentById error:', error);
      throw error;
    }
  }

  async createParent(data: ParentProductFormData & { id?: string }): Promise<ParentProduct> {
    try {
      const parent = await ProductVariantRepository.createParent(data);
      logger.info(`Parent product created: ${parent.id}`);
      return parent;
    } catch (error) {
      logger.error('createParent error:', error);
      throw new Error('Failed to create parent product');
    }
  }

  async updateParent(id: string, data: Partial<ParentProductFormData>): Promise<ParentProduct> {
    try {
      const parent = await ProductVariantRepository.updateParent(id, data);
      logger.info(`Parent product updated: ${id}`);
      return parent;
    } catch (error) {
      logger.error('updateParent error:', error);
      throw new Error('Failed to update parent product');
    }
  }

  async deleteParent(id: string): Promise<void> {
    try {
      await ProductVariantRepository.softDeleteParent(id);
      logger.info(`Parent product archived: ${id}`);
    } catch (error) {
      logger.error('deleteParent error:', error);
      throw new Error('Failed to archive parent product');
    }
  }

  // ── Variants (product_variant) ─────────────────────────────────────────────

  async getVariants(params: PaginationParams): Promise<PaginatedResponse<ProductVariant>> {
    try {
      return await ProductVariantRepository.findAllWithPagination(params);
    } catch (error) {
      logger.error('getVariants error:', error);
      throw new Error('Failed to fetch product variants');
    }
  }

  async getVariantsByProduct(productFlatId: string): Promise<ProductVariant[]> {
    try {
      return await ProductVariantRepository.findByProductFlatId(productFlatId);
    } catch (error) {
      logger.error('getVariantsByProduct error:', error);
      throw error;
    }
  }

  async getVariantsByProductIds(productFlatIds: string[]): Promise<ProductVariant[]> {
    try {
      return await ProductVariantRepository.findByProductFlatIds(productFlatIds);
    } catch (error) {
      logger.error('getVariantsByProductIds error:', error);
      throw error;
    }
  }

  async getVariantById(id: string): Promise<ProductVariant | null> {
    try {
      return await ProductVariantRepository.findById(id);
    } catch (error) {
      logger.error('getVariantById error:', error);
      throw error;
    }
  }

  async getVariantBySKU(sku: string): Promise<ProductVariant | null> {
    try {
      return await ProductVariantRepository.findBySKU(sku);
    } catch (error) {
      logger.error('getVariantBySKU error:', error);
      throw error;
    }
  }

  async getVariantByBarcode(barcode: string): Promise<ProductVariant | null> {
    try {
      return await ProductVariantRepository.findByBarcode(barcode);
    } catch (error) {
      logger.error('getVariantByBarcode error:', error);
      throw error;
    }
  }

  async createVariant(data: ProductVariantFormData): Promise<ProductVariant> {
    try {
      const variant = await ProductVariantRepository.createVariant(data);
      logger.info(`Variant created: ${variant.id}`);
      return variant;
    } catch (error) {
      logger.error('createVariant error:', error);
      throw new Error('Failed to create product variant');
    }
  }

  async updateVariant(id: string, data: Partial<ProductVariantFormData>): Promise<ProductVariant> {
    try {
      const variant = await ProductVariantRepository.updateVariant(id, data);
      logger.info(`Variant updated: ${id}`);
      return variant;
    } catch (error) {
      logger.error('updateVariant error:', error);
      throw new Error('Failed to update product variant');
    }
  }

  async deleteVariant(id: string): Promise<void> {
    try {
      await ProductVariantRepository.softDeleteVariant(id);
      logger.info(`Variant archived: ${id}`);
    } catch (error) {
      logger.error('deleteVariant error:', error);
      throw new Error('Failed to archive product variant');
    }
  }

  // ── Stock ──────────────────────────────────────────────────────────────────

  async updateStock(variantId: string, delta: number): Promise<ProductVariant> {
    try {
      return await ProductVariantRepository.updateStock(variantId, delta);
    } catch (error) {
      logger.error('updateStock error:', error);
      throw new Error('Failed to update variant stock');
    }
  }

  async getLowStockVariants(): Promise<ProductVariant[]> {
    try {
      return await ProductVariantRepository.getLowStockVariants();
    } catch (error) {
      logger.error('getLowStockVariants error:', error);
      throw error;
    }
  }

  async getOutOfStockVariants(): Promise<ProductVariant[]> {
    try {
      return await ProductVariantRepository.getOutOfStockVariants();
    } catch (error) {
      logger.error('getOutOfStockVariants error:', error);
      throw error;
    }
  }
}

export default new ProductVariantService();
