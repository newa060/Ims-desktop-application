import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const BrandsPage = () => {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { loadBrands(); }, []);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const res = await window.electron.getBrands();
      if (res.success) setBrands(res.data);
      else toast.error('Failed to load brands');
    } catch { toast.error('An error occurred'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = editId
        ? await window.electron.updateBrand(editId, formData)
        : await window.electron.createBrand(formData);
      if (res.success) {
        toast.success(editId ? 'Brand updated!' : 'Brand created!');
        loadBrands();
        handleClose();
      } else toast.error(res.error || 'Failed to save brand');
    } catch { toast.error('An error occurred'); }
  };

  const handleEdit = (brand: any) => {
    setEditId(brand.id);
    setFormData({ name: brand.name, description: brand.description || '' });
    setFormOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete brand "${name}"?`)) return;
    try {
      const res = await window.electron.deleteBrand(id);
      if (res.success) { toast.success('Brand deleted'); loadBrands(); }
      else toast.error('Failed to delete brand');
    } catch { toast.error('An error occurred'); }
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditId(null);
    setFormData({ name: '', description: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Brands</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">Manage product brands</p>
        </div>
        <Button onClick={() => { setEditId(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Brand
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Button variant="outline" onClick={loadBrands} className="mb-4">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : brands.length === 0 ? (
            <div className="text-center py-12 text-ink/55">No brands found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                    <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">#</th>
                    <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Brand Name</th>
                    <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Description</th>
                    <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Products</th>
                    <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((brand, i) => (
                    <tr key={brand.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                      <td className="py-3.5 px-4 text-sm text-ink/40">{i + 1}</td>
                      <td className="py-3.5 px-4 text-sm font-semibold text-ink">{brand.name}</td>
                      <td className="py-3.5 px-4 text-sm text-ink/55">{brand.description || '-'}</td>
                      <td className="py-3.5 px-4 text-sm text-ink/55">{brand._count?.products ?? (brand.products?.length ?? 0)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(brand)}>
                            <Edit className="h-4 w-4 text-ink/50" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(brand.id, brand.name)}>
                            <Trash2 className="h-4 w-4 text-danger-text" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Brand' : 'Add Brand'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label>Brand Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit">{editId ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrandsPage;
