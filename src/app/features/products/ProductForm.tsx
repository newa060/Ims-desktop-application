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

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  brandId: z.string().optional(),
  unitId: z.string().min(1, 'Unit is required'),
  purchasePrice: z.coerce.number().min(0, 'Purchase price must be 0 or more'),
  sellingPrice: z.coerce.number().min(0, 'Selling price must be 0 or more'),
  wholesalePrice: z.coerce.number().optional(),
  taxRate: z.coerce.number().min(0).max(100),
  minimumStock: z.coerce.number().min(0),
  currentStock: z.coerce.number().min(0),
  status: z.string().default('active'),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: any;
}

const ProductForm = ({ open, onClose, onSuccess, product }: ProductFormProps) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      taxRate: 0,
      minimumStock: 0,
      currentStock: 0,
      status: 'active',
      purchasePrice: 0,
      sellingPrice: 0,
    },
  });

  useEffect(() => {
    if (open) {
      loadDropdownData();
      if (product) {
        // Populate form for editing
        Object.keys(product).forEach((key) => {
          setValue(key as any, product[key]);
        });
      } else {
        reset({
          taxRate: 0,
          minimumStock: 0,
          currentStock: 0,
          status: 'active',
          purchasePrice: 0,
          sellingPrice: 0,
        });
      }
    }
  }, [open, product]);

  const loadDropdownData = async () => {
    try {
      const [catRes, brandRes, unitRes] = await Promise.all([
        window.electron.getCategories(),
        window.electron.getBrands(),
        window.electron.getUnits(),
      ]);
      if (catRes.success) setCategories(catRes.data);
      if (brandRes.success) setBrands(brandRes.data);
      if (unitRes.success) setUnits(unitRes.data);
    } catch (error) {
      toast.error('Failed to load form data');
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    setLoading(true);
    try {
      let response;
      if (product?.id) {
        response = await window.electron.updateProduct(product.id, data);
      } else {
        response = await window.electron.createProduct(data);
      }

      if (response.success) {
        toast.success(product?.id ? 'Product updated!' : 'Product created!');
        onSuccess();
        onClose();
      } else {
        toast.error(response.error || 'Failed to save product');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateSKU = () => {
    const prefix = 'PRD';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    setValue('sku', `${prefix}-${timestamp}-${random}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product?.id ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4 py-4">

            {/* Name */}
            <div className="col-span-2 space-y-1">
              <Label>Product Name *</Label>
              <Input placeholder="e.g. Samsung Galaxy S24" {...register('name')} />
              {errors.name && <p className="text-xs text-danger-text">{errors.name.message}</p>}
            </div>

            {/* SKU */}
            <div className="space-y-1">
              <Label>SKU *</Label>
              <div className="flex gap-2">
                <Input placeholder="e.g. PRD-001" {...register('sku')} />
                <Button type="button" variant="outline" onClick={generateSKU} className="shrink-0">
                  Auto
                </Button>
              </div>
              {errors.sku && <p className="text-xs text-danger-text">{errors.sku.message}</p>}
            </div>

            {/* Barcode */}
            <div className="space-y-1">
              <Label>Barcode</Label>
              <Input placeholder="e.g. 1234567890123" {...register('barcode')} />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <Label>Category *</Label>
              <Select onValueChange={(val) => setValue('categoryId', val)}
                defaultValue={product?.categoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && <p className="text-xs text-danger-text">{errors.categoryId.message}</p>}
            </div>

            {/* Brand */}
            <div className="space-y-1">
              <Label>Brand</Label>
              <Select onValueChange={(val) => setValue('brandId', val)}
                defaultValue={product?.brandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unit */}
            <div className="space-y-1">
              <Label>Unit *</Label>
              <Select onValueChange={(val) => setValue('unitId', val)}
                defaultValue={product?.unitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.shortName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unitId && <p className="text-xs text-danger-text">{errors.unitId.message}</p>}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label>Status</Label>
              <Select onValueChange={(val) => setValue('status', val)}
                defaultValue={product?.status || 'active'}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Purchase Price */}
            <div className="space-y-1">
              <Label>Purchase Price *</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('purchasePrice')} />
              {errors.purchasePrice && <p className="text-xs text-danger-text">{errors.purchasePrice.message}</p>}
            </div>

            {/* Selling Price */}
            <div className="space-y-1">
              <Label>Selling Price *</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('sellingPrice')} />
              {errors.sellingPrice && <p className="text-xs text-danger-text">{errors.sellingPrice.message}</p>}
            </div>

            {/* Wholesale Price */}
            <div className="space-y-1">
              <Label>Wholesale Price</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('wholesalePrice')} />
            </div>

            {/* Tax Rate */}
            <div className="space-y-1">
              <Label>Tax Rate (%)</Label>
              <Input type="number" step="0.01" placeholder="0" {...register('taxRate')} />
            </div>

            {/* Current Stock */}
            <div className="space-y-1">
              <Label>Current Stock</Label>
              <Input type="number" placeholder="0" {...register('currentStock')} />
            </div>

            {/* Minimum Stock */}
            <div className="space-y-1">
              <Label>Minimum Stock (Alert Level)</Label>
              <Input type="number" placeholder="0" {...register('minimumStock')} />
            </div>

            {/* Description */}
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Textarea
                placeholder="Product description..."
                rows={3}
                {...register('description')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : product?.id ? 'Update Product' : 'Add Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductForm;
