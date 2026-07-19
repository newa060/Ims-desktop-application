/**
 * ProductForm — creates/edits a parent product (product_variant_flat).
 *
 * When CREATING:
 *   1. Creates the parent row via parents:create
 *   2. Creates one default variant row via variants:create
 *
 * When EDITING:
 *   Only the parent-level fields (name, prices, category…) are updated.
 *   Variants are managed separately via VariantForm.
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
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { toast } from 'sonner';

const schema = z.object({
  name:           z.string().min(1, 'Name is required'),
  description:    z.string().optional(),
  categoryId:     z.string().min(1, 'Category is required'),
  brandId:        z.string().optional(),
  unitId:         z.string().min(1, 'Unit is required'),
  purchasePrice:  z.preprocess((val) => (val === '' || val === null || val === undefined) ? undefined : Number(val), z.number().min(0).optional()),
  sellingPrice:   z.preprocess((val) => (val === '' || val === null || val === undefined) ? undefined : Number(val), z.number().min(0).optional()),
  status:         z.string().default('active'),
  // Default variant fields (create-only)
  sku:            z.string().optional(),
  barcode:        z.string().optional(),
  stock:          z.coerce.number().min(0),
  minimumStock:   z.coerce.number().min(0),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open:      boolean;
  onClose:   () => void;
  onSuccess: () => void;
  product?:  any;   // ParentProduct | null for edit, undefined for create
}

const STATUS_TO_DB: Record<string, string> = {
  active:       'Active',
  inactive:     'Draft',
  discontinued: 'Archived',
};

const STATUS_FROM_DB: Record<string, string> = {
  Active:       'active',
  active:       'active',
  Draft:        'inactive',
  inactive:     'inactive',
  Inactive:     'inactive',
  Archived:     'discontinued',
  archived:     'discontinued',
  Discontinued: 'discontinued',
  discontinued: 'discontinued',
};

const ProductForm = ({ open, onClose, onSuccess, product }: Props) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [brands,     setBrands]     = useState<any[]>([]);
  const [units,      setUnits]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const isEdit = Boolean(product?.id);

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'active',
      purchasePrice: undefined, sellingPrice: undefined,
      stock: 0, minimumStock: 0, sku: '',
    },
  });

  const watchedCategoryId = watch('categoryId');
  const watchedBrandId    = watch('brandId');
  const watchedUnitId     = watch('unitId');
  const watchedStatus     = watch('status');

  useEffect(() => {
    if (!open) return;
    loadDropdowns().then((lists) => {
      if (product) {
        // Resolve names to IDs from the fetched dropdown lists
        const catObj = lists.categories.find((c: any) => c.name === product.category?.name || c.name === product.category);
        const brandObj = lists.brands.find((b: any) => b.name === product.brand?.name || b.name === product.brand);
        const unitObj = lists.units.find((u: any) => u.name === product.unit?.name || u.shortName === product.unit?.shortName || u.name === product.unit || u.shortName === product.unit);

        reset({
          name:           product.name           || '',
          description:    product.description    || '',
          categoryId:     catObj?.id             || product.categoryId || '',
          brandId:        brandObj?.id           || product.brandId    || '',
          unitId:         unitObj?.id            || product.unitId     || '',
          purchasePrice:  product.purchasePrice   ?? undefined,
          sellingPrice:   product.sellingPrice    ?? undefined,
          status:         STATUS_FROM_DB[product.status] || product.status || 'active',
          sku:            product.sku            || '',
          barcode:        product.barcode        || '',
          stock:          product.currentStock   ?? product.stock ?? 0,
          minimumStock:   product.minimumStock   ?? 0,
        });
      } else {
        reset({
          status: 'active',
          purchasePrice: undefined, sellingPrice: undefined,
          stock: 0, minimumStock: 0, sku: '',
        });
      }
    });
  }, [open, product]);

  const loadDropdowns = async () => {
    try {
      const [catRes, brandRes, unitRes] = await Promise.all([
        window.electron.getCategories(),
        window.electron.getBrands(),
        window.electron.getUnits(),
      ]);
      const cats = catRes.success ? catRes.data : [];
      const brs = brandRes.success ? brandRes.data : [];
      const uns = unitRes.success ? unitRes.data : [];

      setCategories(cats);
      setBrands(brs);
      setUnits(uns);

      return { categories: cats, brands: brs, units: uns };
    } catch {
      toast.error('Failed to load form data');
      return { categories: [], brands: [], units: [] };
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!isEdit && !data.sku) {
      toast.error('SKU is required for new products');
      return;
    }
    setLoading(true);
    try {
      const dbStatus = STATUS_TO_DB[data.status] ?? 'Active';

      if (isEdit) {
        // Update parent product only
        const res = await window.electron.updateParentProduct(product.id, {
          name:           data.name,
          description:    data.description,
          categoryId:     data.categoryId,
          brandId:        data.brandId,
          unitId:         data.unitId,
          purchasePrice:  data.purchasePrice ?? 0,
          sellingPrice:   data.sellingPrice ?? 0,
          status:         dbStatus,
        });
        if (!res.success) throw new Error(res.error || 'Update failed');
        toast.success('Product updated!');
      } else {
        // 1. Create parent
        const parentRes = await window.electron.createParentProduct({
          name:           data.name,
          description:    data.description,
          categoryId:     data.categoryId,
          brandId:        data.brandId,
          unitId:         data.unitId,
          purchasePrice:  data.purchasePrice ?? 0,
          sellingPrice:   data.sellingPrice ?? 0,
          status:         dbStatus,
        });
        if (!parentRes.success) throw new Error(parentRes.error || 'Failed to create product');

        // 2. Create default variant
        const variantRes = await window.electron.createVariant({
          productFlatId: parentRes.data.id,
          variantName:   'Default',
          sku:           data.sku!,
          barcode:       data.barcode || undefined,
          stock:         data.stock,
          minimumStock:  data.minimumStock,
          status:        dbStatus,
        });
        if (!variantRes.success) throw new Error(variantRes.error || 'Failed to create variant');
        toast.success('Product created!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const autoSKU = () => {
    const ts  = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
    setValue('sku', `PRD-${ts}-${rnd}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          {isEdit && (
            <p className="text-xs text-ink/50 mt-1">
              Editing parent fields only. Use the Variants panel to manage stock, SKU, color, and size.
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Register custom select fields in react-hook-form */}
          <input type="hidden" {...register('categoryId')} />
          <input type="hidden" {...register('brandId')} />
          <input type="hidden" {...register('unitId')} />
          <input type="hidden" {...register('status')} />
          <div className="grid grid-cols-2 gap-4 py-4">

            {/* Name */}
            <div className="col-span-2 space-y-1">
              <Label>Product Name *</Label>
              <Input placeholder="e.g. Classic Oxford Shirt" {...register('name')} />
              {errors.name && <p className="text-xs text-danger-text">{errors.name.message}</p>}
            </div>

            {/* SKU (create only — variants carry these after creation) */}
            {!isEdit && (
              <div className="col-span-2 space-y-1">
                <Label>Default SKU *</Label>
                <div className="flex gap-2">
                  <Input placeholder="e.g. SHIRT-001" {...register('sku')} />
                  <Button type="button" variant="outline" onClick={autoSKU} className="shrink-0">Auto</Button>
                </div>
                {errors.sku && <p className="text-xs text-danger-text">{errors.sku.message}</p>}
              </div>
            )}

            {/* Category */}
            <div className="space-y-1">
              <Label>Category *</Label>
              <Select value={watchedCategoryId || ''} onValueChange={(v) => setValue('categoryId', v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.categoryId && <p className="text-xs text-danger-text">{errors.categoryId.message}</p>}
            </div>

            {/* Brand */}
            <div className="space-y-1">
              <Label>Brand</Label>
              <Select value={watchedBrandId || ''} onValueChange={(v) => setValue('brandId', v)}>
                <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                <SelectContent>
                  {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Unit */}
            <div className="space-y-1">
              <Label>Unit *</Label>
              <Select value={watchedUnitId || ''} onValueChange={(v) => setValue('unitId', v)}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.shortName})</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.unitId && <p className="text-xs text-danger-text">{errors.unitId.message}</p>}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={watchedStatus || 'active'} onValueChange={(v) => setValue('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Purchase Price */}
            <div className="space-y-1">
              <Label>Purchase Price</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('purchasePrice')} />
              {errors.purchasePrice && <p className="text-xs text-danger-text">{errors.purchasePrice.message}</p>}
            </div>

            {/* Selling Price */}
            <div className="space-y-1">
              <Label>Selling Price</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('sellingPrice')} />
              {errors.sellingPrice && <p className="text-xs text-danger-text">{errors.sellingPrice.message}</p>}
            </div>

            {/* Default stock (create only) */}
            {!isEdit && (
              <>
                <div className="space-y-1">
                  <Label>Opening Stock</Label>
                  <Input type="number" placeholder="0" {...register('stock')} />
                </div>
                <div className="space-y-1">
                  <Label>Low Stock Alert</Label>
                  <Input type="number" placeholder="0" {...register('minimumStock')} />
                </div>
              </>
            )}

            {/* Description */}
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Textarea rows={3} placeholder="Product description..." {...register('description')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Add Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductForm;
