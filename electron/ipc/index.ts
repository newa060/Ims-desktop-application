import { setupAuthHandlers } from './auth';
import { setupProductHandlers } from './products';
import { setupVariantHandlers } from './variants';
import { setupSaleHandlers } from './sales';
import { setupDashboardHandlers } from './dashboard';
import { setupCategoryHandlers } from './categories';
import { setupBrandHandlers } from './brands';
import { setupUnitHandlers } from './units';
import { setupCustomerHandlers } from './customers';
import { setupSupplierHandlers } from './suppliers';
import { setupPrintHandlers } from './print';
import { setupBackupHandlers } from './backup';
import { setupSettingsHandlers } from './settings';
import { setupPurchaseHandlers } from './purchases';
import { setupInventoryHandlers } from './inventory';
import { setupExpenseHandlers } from './expenses';
import { setupUserHandlers } from './users';
import { setupStaffHandlers } from './staff';
import { setupCloudinaryHandlers } from './cloudinary';
import logger from '../../src/utils/logger';

export const setupIpcHandlers = () => {
  try {
    setupAuthHandlers();
    setupProductHandlers();
    setupVariantHandlers();
    setupSaleHandlers();
    setupDashboardHandlers();
    setupCategoryHandlers();
    setupBrandHandlers();
    setupUnitHandlers();
    setupCustomerHandlers();
    setupSupplierHandlers();
    setupPrintHandlers();
    setupBackupHandlers();
    setupSettingsHandlers();
    setupPurchaseHandlers();
    setupInventoryHandlers();
    setupExpenseHandlers();
    setupUserHandlers();
    setupStaffHandlers();
    setupCloudinaryHandlers();

    logger.info('IPC handlers initialized');
  } catch (error) {
    logger.error('Failed to initialize IPC handlers:', error);
  }
};
