import { ipcMain } from 'electron';
import SaleService from '../../src/services/SaleService';
import logger from '../../src/utils/logger';

export const setupSaleHandlers = () => {
  ipcMain.handle('sales:getAll', async (_event, params) => {
    try {
      const sales = await SaleService.getSales(params);
      return { success: true, data: sales };
    } catch (error) {
      logger.error('Get sales handler error:', error);
      return { success: false, error: 'Failed to fetch sales' };
    }
  });

  ipcMain.handle('sales:getById', async (_event, id: string) => {
    try {
      const sale = await SaleService.getSaleById(id);
      return { success: true, data: sale };
    } catch (error) {
      logger.error('Get sale by ID handler error:', error);
      return { success: false, error: 'Failed to fetch sale' };
    }
  });

  ipcMain.handle('sales:create', async (_event, data) => {
    try {
      const sale = await SaleService.createSale(data);
      return { success: true, data: sale };
    } catch (error) {
      logger.error('Create sale handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sale',
      };
    }
  });
};
