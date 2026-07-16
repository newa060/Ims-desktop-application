// ============================================================================
// Core domain types for the IMS desktop app.
//
// Architecture after refactor:
//   product_variant_flat  — one row per PARENT product (website / pricing)
//   product_variant       — one row per sellable VARIANT (desktop / stock)
// ============================================================================

export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  roleId: string;
  role: Role;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  roleId: string;
  resource: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

// ── Parent product (product_variant_flat table) ──────────────────────────────

/** Mirrors the product_variant_flat table.  No stock lives here. */
export interface ParentProduct {
  id: string;              // text PK — same as public.products.id
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  brand?: string;
  baseUnit?: string;
  altUnit?: string;
  cFactor?: number;
  purchasePrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  taxRate: number;
  image?: string;
  images?: string[];
  sizes?: string[];
  status: string;
  totalStock?: number;     // Sum of variant stocks
  variants?: ProductVariant[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Variant (product_variant table) ─────────────────────────────────────────

/** Mirrors the product_variant table.  Stock lives here only. */
export interface ProductVariant {
  id: string;              // uuid
  productFlatId: string;   // FK → product_variant_flat.id
  variantName: string;     // e.g. "Black / M"
  sku: string;
  barcode?: string;
  color?: string;
  size?: string;
  stock: number;
  minimumStock: number;
  image?: string;
  status: string;
  // Denormalised from parent (filled by repository join)
  purchasePrice?: number;
  sellingPrice?: number;
  wholesalePrice?: number;
  taxRate?: number;
  productName?: string;
  parent?: ParentProduct;
  createdAt: Date;
  updatedAt: Date;
}

// ── Legacy alias (keeps old code that references Product compiling) ──────────

/** @deprecated Use ParentProduct instead */
export interface Product extends ParentProduct {
  sku: string;             // first variant SKU, kept for compat
  barcode?: string;
  categoryId: string;
  brandId?: string;
  unitId: string;
  minimumStock: number;
  currentStock: number;
}

export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  parent?: Category;
  children?: Category[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Brand {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Unit {
  id: string;
  name: string;
  shortName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  taxNumber?: string;
  balance: number;
  creditLimit: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  country?: string;
  taxNumber?: string;
  creditBalance: number;
  creditLimit: number;
  loyaltyPoints: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplier?: Supplier;
  purchaseDate: Date;
  dueDate?: Date;
  status: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingCost: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod?: string;
  paymentStatus: string;
  notes?: string;
  items?: PurchaseItem[];
  userId: string;
  user?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;        // product_variant_flat.id
  product?: ParentProduct;
  variantId?: string;       // product_variant.id
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface Sale {
  id: string;
  saleNumber: string;
  customerId?: string;
  customer?: Customer;
  saleDate: Date;
  status: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
  items?: SaleItem[];
  userId: string;
  user?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;        // product_variant_flat.id
  product?: ParentProduct;
  variantId?: string;       // product_variant.id
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface Expense {
  id: string;
  categoryId: string;
  category?: ExpenseCategory;
  amount: number;
  date: Date;
  description: string;
  reference?: string;
  paymentMethod?: string;
  receipt?: string;
  userId: string;
  user?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryHistory {
  id: string;
  productId: string;
  product?: ParentProduct;
  variantId?: string;
  variant?: ProductVariant;
  type: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  reference?: string;
  referenceId?: string;
  notes?: string;
  createdAt: Date;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  product?: ParentProduct;
  variantId?: string;
  variant?: ProductVariant;
  type: string;
  quantity: number;
  reason: string;
  notes?: string;
  userId: string;
  user?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: string;
  isRead: boolean;
  priority: string;
  createdAt: Date;
  readAt?: Date;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  description?: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLog {
  id: string;
  userId: string;
  user?: User;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  todaySales: number;
  todayPurchases: number;
  monthlySales: number;
  monthlyPurchases: number;
  monthlyProfit: number;
  totalCustomers: number;
  totalSuppliers: number;
}

export interface SalesChart {
  date: string;
  sales: number;
  profit: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
}

export interface RecentTransaction {
  id: string;
  type: 'sale' | 'purchase';
  number: string;
  date: Date;
  amount: number;
  status: string;
}

// ── Form data ────────────────────────────────────────────────────────────────

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/** Form for creating/editing the parent product (product_variant_flat) */
export interface ParentProductFormData {
  name: string;
  slug?: string;
  description?: string;
  categoryId: string;
  brandId?: string;
  unitId: string;
  purchasePrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  taxRate: number;
  status: string;
}

/** @deprecated Use ParentProductFormData */
export interface ProductFormData extends ParentProductFormData {
  sku: string;
  barcode?: string;
  minimumStock: number;
  currentStock: number;
}

/** Form for creating/editing a variant (product_variant) */
export interface ProductVariantFormData {
  productFlatId: string;
  variantName: string;
  sku: string;
  barcode?: string;
  color?: string;
  size?: string;
  stock: number;
  minimumStock: number;
  image?: string;
  status: string;
}

/** POS cart item — must carry both productFlatId and variantId */
export interface PosCartItem {
  productFlatId: string;
  variantId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  taxRate: number;
  discountAmount: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
