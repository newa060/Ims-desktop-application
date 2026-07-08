import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Plus, Search, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = { name: '', email: '', phone: '', address: '', city: '', country: '', description: '' };

const CustomersPage = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const loadCustomers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await window.electron.getCustomers({ page, limit: 20, search });
      if (res.success) {
        setCustomers(res.data.data);
        setPagination(res.data.pagination);
      } else toast.error('Failed to load customers');
    } catch { toast.error('An error occurred'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadCustomers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = editId
        ? await window.electron.updateCustomer(editId, formData)
        : await window.electron.createCustomer(formData);
      if (res.success) {
        toast.success(editId ? 'Customer updated!' : 'Customer created!');
        loadCustomers();
        handleClose();
      } else toast.error(res.error || 'Failed to save customer');
    } catch { toast.error('An error occurred'); }
  };

  const handleEdit = (c: any) => {
    setEditId(c.id);
    setFormData({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', country: c.country || '', description: c.description || '' });
    setFormOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"?`)) return;
    try {
      const res = await window.electron.deleteCustomer(id);
      if (res.success) { toast.success('Customer deleted'); loadCustomers(); }
      else toast.error('Failed to delete customer');
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
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage your customer database</p>
        </div>
        <Button onClick={() => { setEditId(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadCustomers()} className="pl-10" />
            </div>
            <Button variant="outline" onClick={() => loadCustomers()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No customers found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold">#</th>
                      <th className="text-left py-3 px-4 font-semibold">Name</th>
                      <th className="text-left py-3 px-4 font-semibold">Phone</th>
                      <th className="text-left py-3 px-4 font-semibold">Email</th>
                      <th className="text-left py-3 px-4 font-semibold">City</th>
                      <th className="text-right py-3 px-4 font-semibold">Credit Balance</th>
                      <th className="text-right py-3 px-4 font-semibold">Loyalty</th>
                      <th className="text-center py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, i) => (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{(pagination.page - 1) * pagination.limit + i + 1}</td>
                        <td className="py-3 px-4 font-medium">{c.name}</td>
                        <td className="py-3 px-4 text-gray-500">{c.phone || '-'}</td>
                        <td className="py-3 px-4 text-gray-500">{c.email || '-'}</td>
                        <td className="py-3 px-4 text-gray-500">{c.city || '-'}</td>
                        <td className="py-3 px-4 text-right">${Number(c.creditBalance || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right">{c.loyaltyPoints || 0}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(c)}>
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(c.id, c.name)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                <span>Total: {pagination.total} customer(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => loadCustomers(pagination.page - 1)}><ChevronLeft size={16} /></Button>
                  <span className="px-2 py-1">Page {pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadCustomers(pagination.page + 1)}><ChevronRight size={16} /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-1">
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(e) => updateField('name', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={formData.city} onChange={(e) => updateField('city', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input value={formData.country} onChange={(e) => updateField('country', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Address</Label>
                <Input value={formData.address} onChange={(e) => updateField('address', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Notes</Label>
                <Textarea rows={2} value={formData.description} onChange={(e) => updateField('description', e.target.value)} />
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

export default CustomersPage;
