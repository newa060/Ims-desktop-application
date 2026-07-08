import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(100, 'Password is too long');

export const phoneSchema = z
  .string()
  .regex(/^[0-9+\-\s()]*$/, 'Invalid phone number');

export const positiveNumberSchema = z
  .number()
  .positive('Must be a positive number')
  .or(z.string().transform(Number).pipe(z.number().positive()));

export const nonNegativeNumberSchema = z
  .number()
  .nonnegative('Must be zero or positive')
  .or(z.string().transform(Number).pipe(z.number().nonnegative()));

export const requiredStringSchema = z.string().min(1, 'This field is required');

export const optionalStringSchema = z.string().optional().or(z.literal(''));

export const skuSchema = z
  .string()
  .min(1, 'SKU is required')
  .regex(/^[A-Z0-9-_]+$/, 'SKU must contain only uppercase letters, numbers, hyphens, and underscores');

export const barcodeSchema = z
  .string()
  .optional()
  .refine((val) => !val || /^[0-9]+$/.test(val), {
    message: 'Barcode must contain only numbers',
  });
