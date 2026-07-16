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
  getVariantById: (id: string) => Promise<any>;
  createVariant: (data: any) => Promise<any>;
  updateVariant: (id: string, data: any) => Promise<any>;
  deleteVariant: (id: string) => Promise<any>;
  searchVariantByBarcode: (barcode: string) => Promise<any>;
  searchVariantBySKU: (sku: string) => Promise<any>;
  getVariantsLowStock: () => Promise<any>;

  // Sales
  getSales: (params: any) => Promise<any>;
  getSaleById: (id: string) => Promise<any>;
  createSale: (data: any) => Promise<any>;

  // Purchases
  getPurchases: (params: any) => Promise<any>;
  getPurchaseById: (id: string) => Promise<any>;
  createPurchase: (data: any) => Promise<any>;
  recordPurchasePayment: (data: { purchaseId: string; amount: number }) => Promise<any>;
  getPurchaseReturns: (purchaseId: string) => Promise<any>;
  createPurchaseReturn: (data: any) => Promise<any>;
  createPurchaseRefundOrExchange: (data: any) => Promise<any>;

  // Inventory
  getInventoryHistory: (params: any) => Promise<any>;
  adjustInventory: (data: any) => Promise<any>;
  getLowStock: () => Promise<any>;

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
