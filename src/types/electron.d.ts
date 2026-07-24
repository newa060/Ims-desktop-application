export interface ElectronAPI {
  // Auth
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<any>;
  getCurrentUser: () => Promise<any>;
  setCurrentUser: (user: any) => Promise<any>;

  // Products (legacy — still used for backward compat)
  getProducts: (params: any) => Promise<any>;
  getProductById: (id: string) => Promise<any>;
  createProduct: (data: any) => Promise<any>;
  updateProduct: (id: string, data: any) => Promise<any>;
  deleteProduct: (id: string) => Promise<any>;
  searchProductByBarcode: (barcode: string) => Promise<any>;

  // Parent products (product_variant_flat)
  getParentProducts: (params: any) => Promise<any>;
  getParentById: (id: string) => Promise<any>;
  createParentProduct: (data: any) => Promise<any>;
  updateParentProduct: (id: string, data: any) => Promise<any>;
  deleteParentProduct: (id: string) => Promise<any>;

  // Product Variants (product_variant — desktop primary interface)
  getVariants: (params: any) => Promise<any>;
  getVariantsByProduct: (productFlatId: string) => Promise<any>;
  getVariantsByProductIds: (ids: string[]) => Promise<any>;
  getVariantById: (id: string) => Promise<any>;
  createVariant: (data: any) => Promise<any>;
  updateVariant: (id: string, data: any) => Promise<any>;
  deleteVariant: (id: string) => Promise<any>;
  searchVariantByBarcode: (barcode: string) => Promise<any>;
  searchVariantBySKU: (sku: string) => Promise<any>;
  searchVariants: (query: string, limit?: number) => Promise<any>;
  getVariantsLowStock: () => Promise<any>;
  getVariantsOutOfStock: (params: any) => Promise<any>;

  // Sales
  getSales: (params: any) => Promise<any>;
  getSaleById: (id: string) => Promise<any>;
  createSale: (data: any) => Promise<any>;
  processSaleReturnOrExchange: (data: any) => Promise<any>;
  getSaleReturnsBatch: (saleIds: string[]) => Promise<any>;

  // Purchases
  getPurchases: (params: any) => Promise<any>;
  getPurchaseById: (id: string) => Promise<any>;
  createPurchase: (data: any) => Promise<any>;
  recordPurchasePayment: (data: { purchaseId: string; amount: number }) => Promise<any>;
  getPurchaseReturns: (purchaseId: string) => Promise<any>;
  getPurchaseReturnsBatch: (purchaseIds: string[]) => Promise<any>;
  createPurchaseReturn: (data: any) => Promise<any>;
  createPurchaseRefundOrExchange: (data: any) => Promise<any>;

  // Inventory
  getInventoryHistory: (params: any) => Promise<any>;
  adjustInventory: (data: any) => Promise<any>;
  getLowStock: (params?: any) => Promise<any>;

  // Expenses
  getExpenses: (params: any) => Promise<any>;
  createExpense: (data: any) => Promise<any>;
  updateExpense: (id: string, data: any) => Promise<any>;
  deleteExpense: (id: string) => Promise<any>;
  getExpenseCategories: () => Promise<any>;
  createExpenseCategory: (data: any) => Promise<any>;

  // Users
  getUsers: (params: any) => Promise<any>;
  createUser: (data: any) => Promise<any>;
  updateUser: (id: string, data: any) => Promise<any>;
  deleteUser: (id: string) => Promise<any>;
  getRoles: () => Promise<any>;
  createStaffUserAccount: (params: any) => Promise<any>;
  inspectStaffSchema: () => Promise<any>;
  uploadToCloudinary: (params: { filePath: string; folder: string; publicId?: string }) => Promise<{ success: boolean; url?: string; publicId?: string; error?: string }>;
  uploadToCloudinaryBase64: (params: { base64: string; fileName: string; folder: string; publicId?: string }) => Promise<{ success: boolean; url?: string; publicId?: string; error?: string }>;

  // Dashboard
  getDashboardStats: () => Promise<any>;
  getSalesChart: (days: number) => Promise<any>;
  getTopProducts: (limit: number) => Promise<any>;
  getRecentTransactions: (limit: number) => Promise<any>;

  // Categories
  getCategories: () => Promise<any>;
  createCategory: (data: any) => Promise<any>;
  updateCategory: (id: string, data: any) => Promise<any>;
  deleteCategory: (id: string) => Promise<any>;

  // Brands
  getBrands: () => Promise<any>;
  createBrand: (data: any) => Promise<any>;
  updateBrand: (id: string, data: any) => Promise<any>;
  deleteBrand: (id: string) => Promise<any>;

  // Units
  getUnits: () => Promise<any>;
  createUnit: (data: any) => Promise<any>;
  updateUnit: (id: string, data: any) => Promise<any>;
  deleteUnit: (id: string) => Promise<any>;

  // Customers
  getCustomers: (params: any) => Promise<any>;
  getCustomerById: (id: string) => Promise<any>;
  createCustomer: (data: any) => Promise<any>;
  updateCustomer: (id: string, data: any) => Promise<any>;
  deleteCustomer: (id: string) => Promise<any>;

  // Suppliers
  getSuppliers: (params: any) => Promise<any>;
  getSupplierById: (id: string) => Promise<any>;
  createSupplier: (data: any) => Promise<any>;
  updateSupplier: (id: string, data: any) => Promise<any>;
  deleteSupplier: (id: string) => Promise<any>;
  recordSupplierPayment: (data: any) => Promise<any>;

  // Printing
  printInvoice: (data: any) => Promise<any>;
  printReceipt: (data: any) => Promise<any>;

  // Backup
  createBackup: () => Promise<any>;
  restoreBackup: (filePath: string) => Promise<any>;
  selectAndRestoreBackup: () => Promise<any>;
  getBackups: () => Promise<any>;
  deleteBackup: (fileName: string) => Promise<any>;

  // Settings
  getSettings: () => Promise<any>;
  updateSetting: (key: string, value: string) => Promise<any>;

  // Staff Management
  getStaff: (params: any) => Promise<any>;
  getStaffById: (id: string) => Promise<any>;
  getStaffStats: () => Promise<any>;
  getStaffPresentToday: () => Promise<any>;
  getStaffOnLeave: () => Promise<any>;
  getStaffAllPendingTasks: () => Promise<any>;
  createStaff: (data: any) => Promise<any>;
  updateStaff: (id: string, data: any) => Promise<any>;
  deleteStaff: (id: string) => Promise<any>;
  hardDeleteStaff: (staffId: string, portalUserId?: string) => Promise<any>;
  getStaffAttendance: (staffId: string, year: number, month: number) => Promise<any>;
  recordStaffAttendance: (data: any) => Promise<any>;
  getStaffTasks: (staffId: string) => Promise<any>;
  createStaffTask: (data: any) => Promise<any>;
  updateStaffTaskStatus: (taskId: string, status: string) => Promise<any>;
  deleteStaffTask: (taskId: string) => Promise<any>;
  getStaffPurchases: (staffId: string, params?: any) => Promise<any>;
  recordStaffPurchase: (data: any) => Promise<any>;
  updateStaffPurchaseStatus: (purchaseId: string, status: string, paymentMethod?: string) => Promise<any>;
  getStaffSalaryHistory: (staffId: string) => Promise<any>;
  getStaffSalaryForPeriod: (staffId: string, year: number, month: number) => Promise<any>;
  processStaffSalary: (staffId: string, year: number, month: number, bonus?: number, deductions?: number, notes?: string) => Promise<any>;
  getStaffPayslips: (staffId: string) => Promise<any>;
  generateStaffPayslip: (staffId: string, salaryRecordId: string, generatedByUserId?: string) => Promise<any>;
  getStaffPushCapableIds: () => Promise<{ success: boolean; data?: string[]; error?: string }>;
  sendStaffNotification: (data: {
    title: string;
    body: string;
    recipientMode: 'all' | 'selected';
    staffIds?: string[];
    sentByUserId?: string;
  }) => Promise<{
    success: boolean;
    data?: { notificationId: string; sent: number; skipped: number; failed: number };
    error?: string;
  }>;

  // Notifications
  onNotification: (callback: (notification: any) => void) => void;

  // Auto-updater
  updaterDownload: () => Promise<{ success: boolean; error?: string }>;
  updaterInstall: () => void;
  updaterCheck: () => Promise<{ success: boolean; error?: string }>;
  updaterGetVersion: () => Promise<string>;
  onUpdateAvailable: (cb: (info: { version: string; releaseNotes: any }) => void) => void;
  onUpdateDownloadProgress: (cb: (info: { percent: number }) => void) => void;
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => void;
  onUpdateError: (cb: (info: { message: string }) => void) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
