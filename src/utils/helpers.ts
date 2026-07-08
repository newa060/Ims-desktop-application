import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateSKU = (prefix: string = 'PRD'): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

export const generateInvoiceNumber = (prefix: string = 'INV'): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${prefix}-${year}${month}${day}-${random}`;
};

export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return (value / total) * 100;
};

export const calculateDiscount = (
  price: number,
  discountPercent: number
): number => {
  return (price * discountPercent) / 100;
};

export const calculateTax = (amount: number, taxRate: number): number => {
  return (amount * taxRate) / 100;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const getStockStatus = (
  currentStock: number,
  minimumStock: number
): 'in-stock' | 'low-stock' | 'out-of-stock' => {
  if (currentStock === 0) return 'out-of-stock';
  if (currentStock <= minimumStock) return 'low-stock';
  return 'in-stock';
};

export const getStockStatusColor = (
  currentStock: number,
  minimumStock: number
): string => {
  const status = getStockStatus(currentStock, minimumStock);
  switch (status) {
    case 'in-stock':
      return 'text-green-600';
    case 'low-stock':
      return 'text-yellow-600';
    case 'out-of-stock':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};
