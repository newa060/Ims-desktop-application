export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  
  // Products
  PRODUCTS: '/products',
  PRODUCTS_NEW: '/products/new',
  PRODUCTS_EDIT: '/products/:id/edit',
  PRODUCTS_VIEW: '/products/:id',
  
  // Categories
  CATEGORIES: '/categories',
  
  // Brands
  BRANDS: '/brands',
  
  // Units
  UNITS: '/units',
  
  // Suppliers
  SUPPLIERS: '/suppliers',
  SUPPLIERS_NEW: '/suppliers/new',
  SUPPLIERS_EDIT: '/suppliers/:id/edit',
  SUPPLIERS_VIEW: '/suppliers/:id',
  
  // Customers
  CUSTOMERS: '/customers',
  CUSTOMERS_NEW: '/customers/new',
  CUSTOMERS_EDIT: '/customers/:id/edit',
  CUSTOMERS_VIEW: '/customers/:id',
  
  // Purchases
  PURCHASES: '/purchases',
  PURCHASES_NEW: '/purchases/new',
  PURCHASES_EDIT: '/purchases/:id/edit',
  PURCHASES_VIEW: '/purchases/:id',
  
  // Sales
  SALES: '/sales',
  POS: '/pos',
  SALES_VIEW: '/sales/:id',
  
  // Inventory
  INVENTORY: '/inventory',
  STOCK_ADJUSTMENT: '/inventory/adjustment',
  STOCK_HISTORY: '/inventory/history',
  
  // Expenses
  EXPENSES: '/expenses',
  EXPENSE_CATEGORIES: '/expenses/categories',
  
  // Reports
  REPORTS: '/reports',
  REPORTS_SALES: '/reports/sales',
  REPORTS_PURCHASES: '/reports/purchases',
  REPORTS_INVENTORY: '/reports/inventory',
  REPORTS_PROFIT: '/reports/profit',
  REPORTS_EXPENSES: '/reports/expenses',
  
  // Users & Roles
  USERS: '/users',
  ROLES: '/roles',
  
  // Settings
  SETTINGS: '/settings',
  SETTINGS_GENERAL: '/settings/general',
  SETTINGS_BUSINESS: '/settings/business',
  SETTINGS_INVOICE: '/settings/invoice',
  SETTINGS_BACKUP: '/settings/backup',
  
  // Notifications
  NOTIFICATIONS: '/notifications',
} as const;
