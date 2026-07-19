import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // Auth
  login: (email: string, password: string) => ipcRenderer.invoke('auth:login', email, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  setCurrentUser: (user: any) => ipcRenderer.invoke('auth:setCurrentUser', user),

  // Products
  getProducts: (params: any) => ipcRenderer.invoke('products:getAll', params),
  getProductById: (id: string) => ipcRenderer.invoke('products:getById', id),
  createProduct: (data: any) => ipcRenderer.invoke('products:create', data),
  updateProduct: (id: string, data: any) => ipcRenderer.invoke('products:update', id, data),
  deleteProduct: (id: string) => ipcRenderer.invoke('products:delete', id),
  searchProductByBarcode: (barcode: string) => ipcRenderer.invoke('products:searchByBarcode', barcode),

  // Sales
  getSales: (params: any) => ipcRenderer.invoke('sales:getAll', params),
  getSaleById: (id: string) => ipcRenderer.invoke('sales:getById', id),
  createSale: (data: any) => ipcRenderer.invoke('sales:create', data),

  // Purchases
  getPurchases: (params: any) => ipcRenderer.invoke('purchases:getAll', params),
  getPurchaseById: (id: string) => ipcRenderer.invoke('purchases:getById', id),
  createPurchase: (data: any) => ipcRenderer.invoke('purchases:create', data),
  recordPurchasePayment: (data: any) => ipcRenderer.invoke('purchases:recordPayment', data),
  getPurchaseReturns: (purchaseId: string) => ipcRenderer.invoke('purchases:getReturns', purchaseId),
  createPurchaseReturn: (data: any) => ipcRenderer.invoke('purchases:createReturn', data),

  // Inventory
  getInventoryHistory: (params: any) => ipcRenderer.invoke('inventory:getHistory', params),
  adjustInventory: (data: any) => ipcRenderer.invoke('inventory:adjust', data),
  getLowStock: () => ipcRenderer.invoke('inventory:getLowStock'),

  // Expenses
  getExpenses: (params: any) => ipcRenderer.invoke('expenses:getAll', params),
  createExpense: (data: any) => ipcRenderer.invoke('expenses:create', data),
  updateExpense: (id: string, data: any) => ipcRenderer.invoke('expenses:update', id, data),
  deleteExpense: (id: string) => ipcRenderer.invoke('expenses:delete', id),
  getExpenseCategories: () => ipcRenderer.invoke('expenseCategories:getAll'),
  createExpenseCategory: (data: any) => ipcRenderer.invoke('expenseCategories:create', data),

  // Users
  getUsers: (params: any) => ipcRenderer.invoke('users:getAll', params),
  createUser: (data: any) => ipcRenderer.invoke('users:create', data),
  updateUser: (id: string, data: any) => ipcRenderer.invoke('users:update', id, data),
  deleteUser: (id: string) => ipcRenderer.invoke('users:delete', id),
  getRoles: () => ipcRenderer.invoke('roles:getAll'),
  createStaffUserAccount: (params: any) => ipcRenderer.invoke('staff:createUserAccount', params),
  inspectStaffSchema: () => ipcRenderer.invoke('staff:inspectSchema'),
  uploadToCloudinary: (params: { filePath: string; folder: string; publicId?: string }) =>
    ipcRenderer.invoke('staff:uploadToCloudinary', params),
  uploadToCloudinaryBase64: (params: { base64: string; fileName: string; folder: string; publicId?: string }) =>
    ipcRenderer.invoke('staff:uploadToCloudinaryBase64', params),

  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('dashboard:getStats'),
  getSalesChart: (days: number) => ipcRenderer.invoke('dashboard:getSalesChart', days),
  getTopProducts: (limit: number) => ipcRenderer.invoke('dashboard:getTopProducts', limit),
  getRecentTransactions: (limit: number) => ipcRenderer.invoke('dashboard:getRecentTransactions', limit),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  createCategory: (data: any) => ipcRenderer.invoke('categories:create', data),
  updateCategory: (id: string, data: any) => ipcRenderer.invoke('categories:update', id, data),
  deleteCategory: (id: string) => ipcRenderer.invoke('categories:delete', id),

  // Brands
  getBrands: () => ipcRenderer.invoke('brands:getAll'),
  createBrand: (data: any) => ipcRenderer.invoke('brands:create', data),
  updateBrand: (id: string, data: any) => ipcRenderer.invoke('brands:update', id, data),
  deleteBrand: (id: string) => ipcRenderer.invoke('brands:delete', id),

  // Units
  getUnits: () => ipcRenderer.invoke('units:getAll'),
  createUnit: (data: any) => ipcRenderer.invoke('units:create', data),
  updateUnit: (id: string, data: any) => ipcRenderer.invoke('units:update', id, data),
  deleteUnit: (id: string) => ipcRenderer.invoke('units:delete', id),

  // Customers
  getCustomers: (params: any) => ipcRenderer.invoke('customers:getAll', params),
  getCustomerById: (id: string) => ipcRenderer.invoke('customers:getById', id),
  createCustomer: (data: any) => ipcRenderer.invoke('customers:create', data),
  updateCustomer: (id: string, data: any) => ipcRenderer.invoke('customers:update', id, data),
  deleteCustomer: (id: string) => ipcRenderer.invoke('customers:delete', id),

  // Suppliers
  getSuppliers: (params: any) => ipcRenderer.invoke('suppliers:getAll', params),
  getSupplierById: (id: string) => ipcRenderer.invoke('suppliers:getById', id),
  createSupplier: (data: any) => ipcRenderer.invoke('suppliers:create', data),
  updateSupplier: (id: string, data: any) => ipcRenderer.invoke('suppliers:update', id, data),
  deleteSupplier: (id: string) => ipcRenderer.invoke('suppliers:delete', id),
  recordSupplierPayment: (data: any) => ipcRenderer.invoke('suppliers:recordPayment', data),

  // Printing
  printInvoice: (data: any) => ipcRenderer.invoke('print:invoice', data),
  printReceipt: (data: any) => ipcRenderer.invoke('print:receipt', data),

  // Backup
  createBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
  selectAndRestoreBackup: () => ipcRenderer.invoke('backup:selectAndRestore'),
  getBackups: () => ipcRenderer.invoke('backup:getAll'),
  deleteBackup: (fileName: string) => ipcRenderer.invoke('backup:delete', fileName),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  updateSetting: (key: string, value: string) => ipcRenderer.invoke('settings:update', key, value),

  // Staff Management
  getStaff: (params: any) => ipcRenderer.invoke('staff:getAll', params),
  getStaffById: (id: string) => ipcRenderer.invoke('staff:getById', id),
  getStaffStats: () => ipcRenderer.invoke('staff:getStats'),
  getStaffPresentToday: () => ipcRenderer.invoke('staff:getPresentToday'),
  getStaffOnLeave: () => ipcRenderer.invoke('staff:getOnLeave'),
  getStaffAllPendingTasks: () => ipcRenderer.invoke('staff:getAllPendingTasks'),
  createStaff: (data: any) => ipcRenderer.invoke('staff:create', data),
  updateStaff: (id: string, data: any) => ipcRenderer.invoke('staff:update', id, data),
  deleteStaff: (id: string) => ipcRenderer.invoke('staff:delete', id),
  hardDeleteStaff: (staffId: string, portalUserId?: string) => ipcRenderer.invoke('staff:hardDelete', staffId, portalUserId),
  getStaffAttendance: (staffId: string, year: number, month: number) => ipcRenderer.invoke('staff:getAttendance', staffId, year, month),
  recordStaffAttendance: (data: any) => ipcRenderer.invoke('staff:recordAttendance', data),
  getStaffTasks: (staffId: string) => ipcRenderer.invoke('staff:getTasks', staffId),
  createStaffTask: (data: any) => ipcRenderer.invoke('staff:createTask', data),
  updateStaffTaskStatus: (taskId: string, status: string) => ipcRenderer.invoke('staff:updateTaskStatus', taskId, status),
  deleteStaffTask: (taskId: string) => ipcRenderer.invoke('staff:deleteTask', taskId),
  getStaffPurchases: (staffId: string, params?: any) => ipcRenderer.invoke('staff:getPurchases', staffId, params),
  recordStaffPurchase: (data: any) => ipcRenderer.invoke('staff:recordPurchase', data),
  updateStaffPurchaseStatus: (purchaseId: string, status: string, paymentMethod?: string) => ipcRenderer.invoke('staff:updatePurchaseStatus', purchaseId, status, paymentMethod),
  getStaffSalaryHistory: (staffId: string) => ipcRenderer.invoke('staff:getSalaryHistory', staffId),
  getStaffSalaryForPeriod: (staffId: string, year: number, month: number) => ipcRenderer.invoke('staff:getSalaryForPeriod', staffId, year, month),
  processStaffSalary: (staffId: string, year: number, month: number, bonus?: number, deductions?: number, notes?: string) => ipcRenderer.invoke('staff:processSalary', staffId, year, month, bonus, deductions, notes),
  getStaffPayslips: (staffId: string) => ipcRenderer.invoke('staff:getPayslips', staffId),
  generateStaffPayslip: (staffId: string, salaryRecordId: string, generatedByUserId?: string) => ipcRenderer.invoke('staff:generatePayslip', staffId, salaryRecordId, generatedByUserId),
  getStaffPushCapableIds: () => ipcRenderer.invoke('staff:getPushCapableIds'),
  sendStaffNotification: (data: {
    title: string;
    body: string;
    recipientMode: 'all' | 'selected';
    staffIds?: string[];
    sentByUserId?: string;
  }) => ipcRenderer.invoke('staff:sendNotification', data),

  // Notifications
  onNotification: (callback: (notification: any) => void) => {
    ipcRenderer.on('notification', (_event, notification) => callback(notification));
  },

  // Auto-updater
  updaterDownload: () => ipcRenderer.invoke('updater:download'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterGetVersion: () => ipcRenderer.invoke('updater:getVersion'),
  onUpdateAvailable: (cb: (info: { version: string; releaseNotes: any }) => void) => {
    ipcRenderer.on('update:available', (_e, info) => cb(info));
  },
  onUpdateDownloadProgress: (cb: (info: { percent: number }) => void) => {
    ipcRenderer.on('update:download-progress', (_e, info) => cb(info));
  },
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
    ipcRenderer.on('update:downloaded', (_e, info) => cb(info));
  },
  onUpdateError: (cb: (info: { message: string }) => void) => {
    ipcRenderer.on('update:error', (_e, info) => cb(info));
  },
});
