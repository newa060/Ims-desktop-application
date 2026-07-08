export const RESOURCES = {
  DASHBOARD: 'dashboard',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  BRANDS: 'brands',
  UNITS: 'units',
  SUPPLIERS: 'suppliers',
  CUSTOMERS: 'customers',
  PURCHASES: 'purchases',
  SALES: 'sales',
  INVENTORY: 'inventory',
  EXPENSES: 'expenses',
  REPORTS: 'reports',
  USERS: 'users',
  ROLES: 'roles',
  SETTINGS: 'settings',
  BACKUP: 'backup',
} as const;

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  STAFF: 'staff',
} as const;

export type ResourceType = typeof RESOURCES[keyof typeof RESOURCES];
export type ActionType = typeof ACTIONS[keyof typeof ACTIONS];
export type RoleType = typeof ROLES[keyof typeof ROLES];
