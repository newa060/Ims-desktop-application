import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Plus, Search, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';

const emptyForm = { name: '', email: '', phone: '', address: '', city: '', country: '', taxNumber: '', description: '' };

const SuppliersPage = () => {
  const { formatCurrency } = useSettings();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const loadSuppliers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await window.electron.getSuppliers({ page, limit: 20, search });
      if (res.success) {
        setSuppliers(res.data.data);
        setPagination(res.data.pagination);
      } else toast.error('Failed to load suppliers');
    } catch { toast.error('An error occurred'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadSuppliers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = editId
        ? await window.electron.updateSupplier(editId, formData)
        : await window.electron.createSupplier(formData);
      if (res.success) {
        toast.success(editId ? 'Supplier updated!' : 'Supplier created!');
        loadSuppliers();
        handleClose();
      } else toast.error(res.error || 'Failed to save supplier');
    } catch { toast.error('An error occurred'); }
  };

  const handleEdit = (s: any) => {
    setEditId(s.id);
    setFormData({ name: s.name, email: s.email || '', phone: s.phone || '', address: s.address || '', city: s.city || '', country: s.country || '', taxNumber: s.taxNumber || '', description: s.description || '' });
    setFormOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete supplier "${name}"?`)) return;
    try {
      const res = await window.electron.deleteSupplier(id);
      if (res.success) { toast.success('Supplier deleted'); loadSuppliers(); }
      else toast.error('Failed to delete supplier');
    } catch { toast.error('An error occurred'); }
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditId(null);
    setFormData(emptyForm);
  };

  const updateField = (field: string, value: string) => setFormData((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Suppliers</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">Manage your suppliers and purchase partners</p>
        </div>
        <Button onClick={() => { setEditId(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Supplier
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={18} />
              <Input placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadSuppliers()} className="pl-10" />
            </div>
            <Button variant="outline" onClick={() => loadSuppliers()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12 text-ink/55">No suppliers found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">#</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Name</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Phone</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Email</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">City</th>
                      <th className="text-right py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Balance</th>
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s, i) => (
                      <tr key={s.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                        <td className="py-3 px-4">{(pagination.page - 1) * pagination.limit + i + 1}</td>
                        <td className="py-3 px-4 text-sm font-semibold text-ink">{s.name}</td>
                        <td className="py-3 px-4 text-ink/55">{s.phone || '-'}</td>
                        <td className="py-3 px-4 text-ink/55">{s.email || '-'}</td>
                        <td className="py-3 px-4 text-ink/55">{s.city || '-'}</td>
                        <td className="py-3 px-4 text-right font-bold text-ink">{formatCurrency(s.balance)}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(s)}>
                              <Edit className="h-4 w-4 text-ink/50" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(s.id, s.name)}>
                              <Trash2 className="h-4 w-4 text-danger-text" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 text-sm text-ink/55">
                <span>Total: {pagination.total} supplier(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => loadSuppliers(pagination.page - 1)}><ChevronLeft size={16} /></Button>
                  <span className="px-2 py-1">Page {pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadSuppliers(pagination.page + 1)}><ChevronRight size={16} /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input value={formData.name} onChange={(e) => updateField('name', e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Phone *</Label>
                  <Input value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Tax Number (VAT/PAN)</Label>
                  <Input value={formData.taxNumber} onChange={(e) => updateField('taxNumber', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input value={formData.address} onChange={(e) => updateField('address', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>City</Label>
                    <Input value={formData.city} onChange={(e) => updateField('city', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Country</Label>
                    <Input value={formData.country} onChange={(e) => updateField('country', e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={3} value={formData.description} onChange={(e) => updateField('description', e.target.value)} />
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

export default SuppliersPage;
