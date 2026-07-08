import { format, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

export const formatDate = (date: Date | string, formatStr: string = 'yyyy-MM-dd'): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr);
};

export const formatDateTime = (date: Date | string): string => {
  return formatDate(date, 'yyyy-MM-dd HH:mm:ss');
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const getTodayRange = () => {
  const today = new Date();
  return {
    start: startOfDay(today),
    end: endOfDay(today),
  };
};

export const getMonthRange = (date: Date = new Date()) => {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
};

export const getDateRange = (startDate: Date, endDate: Date) => {
  return {
    start: startOfDay(startDate),
    end: endOfDay(endDate),
  };
};
