import { ipcMain } from 'electron';
import DashboardService from '../../src/services/DashboardService';
import logger from '../../src/utils/logger';

export const setupDashboardHandlers = () => {
  ipcMain.handle('dashboard:getStats', async () => {
    try {
      const stats = await DashboardService.getDashboardStats();
      return { success: true, data: stats };
    } catch (error) {
      logger.error('Get dashboard stats handler error:', error);
      return { success: false, error: 'Failed to fetch dashboard stats' };
    }
  });

  ipcMain.handle('dashboard:getSalesChart', async (_event, days: number) => {
    try {
      const chartData = await DashboardService.getSalesChart(days);
      return { success: true, data: chartData };
    } catch (error) {
      logger.error('Get sales chart handler error:', error);
      return { success: false, error: 'Failed to fetch sales chart data' };
    }
  });

  ipcMain.handle('dashboard:getTopProducts', async (_event, limit: number) => {
    try {
      const topProducts = await DashboardService.getTopProducts(limit);
      return { success: true, data: topProducts };
    } catch (error) {
      logger.error('Get top products handler error:', error);
      return { success: false, error: 'Failed to fetch top products' };
    }
  });

  ipcMain.handle('dashboard:getRecentTransactions', async (_event, limit: number) => {
    try {
      const transactions = await DashboardService.getRecentTransactions(limit);
      return { success: true, data: transactions };
    } catch (error) {
      logger.error('Get recent transactions handler error:', error);
      return { success: false, error: 'Failed to fetch recent transactions' };
    }
  });
};
