export const PRODUCT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DISCONTINUED: 'discontinued',
} as const;

export const PURCHASE_STATUS = {
  PENDING: 'pending',
  RECEIVED: 'received',
  PARTIAL: 'partial',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_STATUS = {
  PAID: 'paid',
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  OVERDUE: 'overdue',
} as const;

export const SALE_STATUS = {
  COMPLETED: 'completed',
  PENDING: 'pending',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'cash',
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  BANK_TRANSFER: 'bank_transfer',
  CHECK: 'check',
  MOBILE_PAYMENT: 'mobile_payment',
} as const;

export const INVENTORY_TRANSACTION_TYPES = {
  PURCHASE: 'purchase',
  SALE: 'sale',
  ADJUSTMENT: 'adjustment',
  RETURN: 'return',
  TRANSFER: 'transfer',
  DAMAGE: 'damage',
} as const;

export const NOTIFICATION_TYPES = {
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
  BACKUP_REMINDER: 'backup_reminder',
  SYSTEM: 'system',
} as const;

export const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
