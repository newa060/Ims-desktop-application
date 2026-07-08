import { ipcMain } from 'electron';
import ProductService from '../../src/services/ProductService';
import logger from '../../src/utils/logger';

export const setupProductHandlers = () => {
  ipcMain.handle('products:getAll', async (_event, params) => {
    try {
      const products = await ProductService.getProducts(params);
      return { success: true, data: products };
    } catch (error) {
      logger.error('Get products handler error:', error);
      return { success: false, error: 'Failed to fetch products' };
    }
  });

  ipcMain.handle('products:getById', async (_event, id: string) => {
    try {
      const product = await ProductService.getProductById(id);
      return { success: true, data: product };
    } catch (error) {
      logger.error('Get product by ID handler error:', error);
      return { success: false, error: 'Failed to fetch product' };
    }
  });

  ipcMain.handle('products:create', async (_event, data) => {
    try {
      const product = await ProductService.createProduct(data);
      return { success: true, data: product };
    } catch (error) {
      logger.error('Create product handler error:', error);
      return { success: false, error: 'Failed to create product' };
    }
  });

  ipcMain.handle('products:update', async (_event, id: string, data) => {
    try {
      const product = await ProductService.updateProduct(id, data);
      return { success: true, data: product };
    } catch (error) {
      logger.error('Update product handler error:', error);
      return { success: false, error: 'Failed to update product' };
    }
  });

  ipcMain.handle('products:delete', async (_event, id: string) => {
    try {
      await ProductService.deleteProduct(id);
      return { success: true };
    } catch (error) {
      logger.error('Delete product handler error:', error);
      return { success: false, error: 'Failed to delete product' };
    }
  });

  ipcMain.handle('products:searchByBarcode', async (_event, barcode: string) => {
    try {
      const product = await ProductService.getProductByBarcode(barcode);
      return { success: true, data: product };
    } catch (error) {
      logger.error('Search product by barcode handler error:', error);
      return { success: false, error: 'Failed to search product' };
    }
  });
};
