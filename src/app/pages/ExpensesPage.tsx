import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight, Tags } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = { categoryId: '', amount: 0, description: '', reference: '', paymentMethod: 'cash', date: new Date().toISOString().split('T')[0] };

const ExpensesPage = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [catName, setCatName] = useState('');

  const loadExpenses = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await window.electron.getExpenses({ page, limit: 20 });
      if (res.success) {
        setExpenses(res.data.data);
        setPagination(res.data.pagination);
      } else toast.error('Failed to load expenses');
    } catch { toast.error('An error occurred'); }
    finally { setLoading(false); }
  }, []);

  const loadCategories = async () => {
    const res = await window.electron.getExpenseCategories();
    if (res.success) setCategories(res.data);
  };

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, []);

  const handleOpenForm = () => {
    loadCategories();
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...formData, userId: user?.id };
      const res = editId
        ? await window.electron.updateExpense(editId, data)
        : await window.electron.createExpense(data);
      if (res.success) {
        toast.success(editId ? 'Expense updated!' : 'Expense created!');
        loadExpenses();
        handleClose();
      } else toast.error(res.error || 'Failed to save expense');
    } catch { toast.error('An error occurred'); }
  };

  const handleEdit = (e: any) => {
    setEditId(e.id);
    setFormData({
      categoryId: e.categoryId, amount: e.amount, description: e.description || '',
      reference: e.reference || '', paymentMethod: e.paymentMethod || 'cash',
      date: e.date ? new Date(e.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      const res = await window.electron.deleteExpense(id);
      if (res.success) { toast.success('Expense deleted'); loadExpenses(); }
      else toast.error('Failed to delete expense');
    } catch { toast.error('An error occurred'); }
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditId(null);
    setFormData(emptyForm);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await window.electron.createExpenseCategory({ name: catName });
      if (res.success) {
        toast.success('Category created!');
        loadCategories();
        setCatFormOpen(false);
        setCatName('');
      } else toast.error('Failed to create category');
    } catch { toast.error('An error occurred'); }
  };

  const updateField = (field: string, value: any) => setFormData((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 mt-1">Track your business expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatFormOpen(true)}><Tags className="mr-2 h-4 w-4" /> Categories</Button>
          <Button onClick={handleOpenForm}><Plus className="mr-2 h-4 w-4" /> Add Expense</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Button variant="outline" onClick={() => loadExpenses()} className="mb-4"><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No expenses found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-semibold">Category</th>
                      <th className="text-left py-3 px-4 font-semibold">Description</th>
                      <th className="text-left py-3 px-4 font-semibold">Reference</th>
                      <th className="text-right py-3 px-4 font-semibold">Amount</th>
                      <th className="text-center py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-500">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">{exp.category?.name}</td>
                        <td className="py-3 px-4 text-gray-600">{exp.description}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{exp.reference || '-'}</td>
                        <td className="py-3 px-4 text-right font-semibold text-red-600">${Number(exp.amount).toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(exp)}>
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(exp.id)}>
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
                <span>Total: {pagination.total} expense(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => loadExpenses(pagination.page - 1)}><ChevronLeft size={16} /></Button>
                  <span className="px-2 py-1">Page {pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadExpenses(pagination.page + 1)}><ChevronRight size={16} /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Category *</Label>
                  <Select value={formData.categoryId} onValueChange={(v) => updateField('categoryId', v)}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => updateField('date', e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Amount *</Label>
                <Input type="number" step="0.01" min="0" value={formData.amount} onChange={(e) => updateField('amount', parseFloat(e.target.value) || 0)} required />
              </div>
              <div className="space-y-1">
                <Label>Description *</Label>
                <Textarea rows={2} value={formData.description} onChange={(e) => updateField('description', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Payment Method</Label>
                  <Select value={formData.paymentMethod} onValueChange={(v) => updateField('paymentMethod', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Reference</Label>
                  <Input placeholder="Receipt/Invoice #" value={formData.reference} onChange={(e) => updateField('reference', e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit">{editId ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={catFormOpen} onOpenChange={setCatFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label>Category Name *</Label>
                <Input placeholder="e.g. Rent, Utilities, Salaries" value={catName} onChange={(e) => setCatName(e.target.value)} required />
              </div>
              {categories.length > 0 && (
                <div className="border rounded p-3 max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium mb-2">Existing Categories:</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => <span key={c.id} className="text-xs bg-gray-100 px-2 py-1 rounded">{c.name}</span>)}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setCatFormOpen(false); setCatName(''); }}>Cancel</Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesPage;
