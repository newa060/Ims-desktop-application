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
import { useSettings } from '../contexts/SettingsContext';

const emptyForm = { categoryId: '', amount: 0, description: '', reference: '', paymentMethod: 'cash', date: new Date().toISOString().split('T')[0] };

const ExpensesPage = () => {
  const { formatCurrency } = useSettings();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [catFormData, setCatFormData] = useState({ name: '', description: '' });
  const [editId, setEditId] = useState<string | null>(null);

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
    try {
      const res = await window.electron.getExpenseCategories();
      if (res.success) setCategories(res.data);
    } catch {}
  };

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, userId: user?.id };
      const res = editId
        ? await window.electron.updateExpense(editId, payload)
        : await window.electron.createExpense(payload);
      if (res.success) {
        toast.success(editId ? 'Expense updated!' : 'Expense created!');
        loadExpenses();
        handleClose();
      } else toast.error(res.error || 'Failed to save expense');
    } catch { toast.error('An error occurred'); }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await window.electron.createExpenseCategory(catFormData);
      if (res.success) {
        toast.success('Category created!');
        loadCategories();
        setCatOpen(false);
        setCatFormData({ name: '', description: '' });
      } else toast.error(res.error || 'Failed to create category');
    } catch { toast.error('An error occurred'); }
  };

  const handleEdit = (exp: any) => {
    setEditId(exp.id);
    setFormData({
      categoryId: exp.categoryId,
      amount: exp.amount,
      description: exp.description || '',
      reference: exp.reference || '',
      paymentMethod: exp.paymentMethod || 'cash',
      date: new Date(exp.date).toISOString().split('T')[0]
    });
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const res = await window.electron.deleteExpense(id);
      if (res.success) {
        toast.success('Expense deleted');
        loadExpenses();
      } else toast.error('Failed to delete expense');
    } catch { toast.error('An error occurred'); }
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditId(null);
    setFormData(emptyForm);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Expenses</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">Track and manage business operational costs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatOpen(true)}>
            <Tags className="mr-2 h-4 w-4" /> Categories
          </Button>
          <Button onClick={() => { setEditId(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-semibold text-[17px] text-ink">Expense Log</h2>
            <Button variant="outline" onClick={() => loadExpenses()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12 text-ink/55">No expenses logged</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Date</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Category</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Description</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Ref #</th>
                      <th className="text-right py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Amount</th>
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                        <td className="py-3 px-4 text-ink/55">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">{exp.category?.name}</td>
                        <td className="py-3 px-4 text-ink/60">{exp.description}</td>
                        <td className="py-3 px-4 text-ink/55 text-xs">{exp.reference || '-'}</td>
                        <td className="py-3 px-4 text-right font-semibold text-danger-text">{formatCurrency(exp.amount)}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(exp)}>
                              <Edit className="h-4 w-4 text-ink/50" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(exp.id)}>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Expense' : 'Log Expense'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Category *</Label>
              <Select value={formData.categoryId} onValueChange={(v) => setFormData({ ...formData, categoryId: v })} required>
                <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" min="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} required />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reference (Optional)</Label>
              <Input value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} placeholder="e.g. Receipt # or Check #" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required placeholder="Provide details..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit">{editId ? 'Update' : 'Log Expense'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Expense Categories</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <form onSubmit={handleCreateCategory} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label>New Category Name</Label>
                <Input value={catFormData.name} onChange={(e) => setCatFormData({ ...catFormData, name: e.target.value })} placeholder="Category name..." required />
              </div>
              <Button type="submit">Create</Button>
            </form>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#faf9f5] border-b"><th className="text-left py-2 px-3">Name</th></tr></thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id} className="border-b last:border-0"><td className="py-2 px-3">{c.name}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesPage;
