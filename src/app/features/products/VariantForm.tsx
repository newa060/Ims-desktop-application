/**
 * VariantForm — add / edit a product_variant row.
 *
 * Fields stored in product_variant:
 *   variant_name, sku, barcode, color, size,
 *   stock, minimum_stock, image
 *
 * Status is managed at the parent product level (product_variant_flat).
 * productFlatId = FK → product_variant_flat.id
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

import { toast } from 'sonner';

const variantSchema = z.object({
  variantName:  z.string().min(1, 'Variant name is required'),
  sku:          z.string().min(1, 'SKU is required'),
  barcode:      z.string().optional(),
  color:        z.string().optional(),
  size:         z.string().optional(),
  stock:        z.coerce.number().min(0),
  minimumStock: z.coerce.number().min(0),
});

type VariantFormData = z.infer<typeof variantSchema>;

interface VariantFormProps {
  open:         boolean;
  onClose:      () => void;
  onSuccess:    () => void;
  productFlatId: string;   // FK → product_variant_flat.id
  productName:  string;
  variant?:     any;        // existing variant for edit
}

const VariantForm = ({
  open, onClose, onSuccess, productFlatId, productName, variant,
}: VariantFormProps) => {
  const [loading, setLoading] = useState(false);

  const {
    register, handleSubmit, setValue, reset,
    formState: { errors },
  } = useForm<VariantFormData>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      variantName: 'Default', sku: '', barcode: '',
      color: '', size: '', stock: 0, minimumStock: 0,
    },
  });


  useEffect(() => {
    if (!open) return;
    if (variant) {
      reset({
        variantName:  variant.variantName  ?? variant.variant_name  ?? 'Default',
        sku:          variant.sku          ?? '',
        barcode:      variant.barcode      ?? '',
        color:        variant.color        ?? '',
        size:         variant.size         ?? '',
        stock:        variant.stock        ?? 0,
        // support both old (lowStockLimit) and new (minimumStock) field names
        minimumStock: variant.minimumStock ?? variant.lowStockLimit ?? variant.minimum_stock ?? 0,
      });
    } else {
      reset({
        variantName: 'Default', sku: '', barcode: '',
        color: '', size: '', stock: 0, minimumStock: 0,
      });
    }
  }, [open, variant]);

  const autoSKU = () => {
    const ts  = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
    setValue('sku', `VAR-${ts}-${rnd}`);
  };

  const onSubmit = async (data: VariantFormData) => {
    setLoading(true);
    try {
      let res;
      if (variant?.id) {
        res = await window.electron.updateVariant(variant.id, {
          variantName:  data.variantName,
          sku:          data.sku,
          barcode:      data.barcode  || undefined,
          color:        data.color    || undefined,
          size:         data.size     || undefined,
          stock:        data.stock,
          minimumStock: data.minimumStock,
        });
      } else {
        res = await window.electron.createVariant({
          productFlatId,          // ← correct FK field
          variantName:  data.variantName,
          sku:          data.sku,
          barcode:      data.barcode  || undefined,
          color:        data.color    || undefined,
          size:         data.size     || undefined,
          stock:        data.stock,
          minimumStock: data.minimumStock,
        });
      }

      if (res.success) {
        toast.success(variant?.id ? 'Variant updated!' : 'Variant added!');
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || 'Failed to save variant');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {variant?.id ? 'Edit Variant' : 'Add Variant'} — {productName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4 py-4">

            {/* Variant Name */}
            <div className="col-span-2 space-y-1">
              <Label>Variant Name *</Label>
              <Input placeholder="e.g. Black / M, Default, Red XL" {...register('variantName')} />
              {errors.variantName && (
                <p className="text-xs text-danger-text">{errors.variantName.message}</p>
              )}
            </div>

            {/* Color */}
            <div className="space-y-1">
              <Label>Color</Label>
              <Input placeholder="e.g. Black, White, Red" {...register('color')} />
            </div>

            {/* Size */}
            <div className="space-y-1">
              <Label>Size</Label>
              <Input placeholder="e.g. S, M, L, XL" {...register('size')} />
            </div>

            {/* SKU */}
            <div className="col-span-2 space-y-1">
              <Label>SKU *</Label>
              <div className="flex gap-2">
                <Input placeholder="e.g. SHIRT-BLK-M" {...register('sku')} />
                <Button type="button" variant="outline" onClick={autoSKU} className="shrink-0">
                  Auto
                </Button>
              </div>
              {errors.sku && <p className="text-xs text-danger-text">{errors.sku.message}</p>}
            </div>

            {/* Barcode */}
            <div className="col-span-2 space-y-1">
              <Label>Barcode</Label>
              <Input placeholder="e.g. 1234567890123" {...register('barcode')} />
            </div>

            {/* Stock */}
            <div className="space-y-1">
              <Label>Current Stock</Label>
              <Input type="number" min="0" placeholder="0" {...register('stock')} />
            </div>

            {/* Minimum Stock */}
            <div className="space-y-1">
              <Label>Low Stock Alert Level</Label>
              <Input type="number" min="0" placeholder="0" {...register('minimumStock')} />
            </div>



          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : variant?.id ? 'Update Variant' : 'Add Variant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VariantForm;
