import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const CategoriesPage = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '', description: '', parentId: '' });
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await window.electron.getCategories();
      if (res.success) setCategories(res.data);
      else toast.error('Failed to load categories');
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...formData, parentId: formData.parentId || null };
      const res = editId
        ? await window.electron.updateCategory(editId, data)
        : await window.electron.createCategory(data);
      if (res.success) {
        toast.success(editId ? 'Category updated!' : 'Category created!');
        loadCategories();
        handleClose();
      } else {
        toast.error(res.error || 'Failed to save category');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleEdit = (cat: any) => {
    setEditId(cat.id);
    setFormData({ name: cat.name, description: cat.description || '', parentId: cat.parentId || '' });
    setFormOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await window.electron.deleteCategory(id);
      if (res.success) {
        toast.success('Category deleted');
        loadCategories();
      } else toast.error('Failed to delete category');
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditId(null);
    setFormData({ name: '', description: '', parentId: '' });
  };

  const rootCategories = categories.filter((c) => !c.parentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Categories</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">Organize your products by categories</p>
        </div>
        <Button onClick={() => { setEditId(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Category
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-4">
            <Button variant="outline" onClick={loadCategories}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-ink/55">
              <p>No categories found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                    <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">#</th>
                    <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Name</th>
                    <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Parent</th>
                    <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Description</th>
                    <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rootCategories.map((cat, idx) => (
                    <RenderCategoryRow key={cat.id} cat={cat} idx={idx} categories={categories} onEdit={handleEdit} onDelete={handleDelete} level={0} />
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
            <DialogTitle>{editId ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Parent Category</Label>
                <Select value={formData.parentId} onValueChange={(val) => setFormData({ ...formData, parentId: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="None (Root Category)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (Root Category)</SelectItem>
                    {categories.filter((c) => c.id !== editId).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

const RenderCategoryRow = ({ cat, idx, categories, onEdit, onDelete, level }: any) => {
  const children = categories.filter((c: any) => c.parentId === cat.id);
  return (
    <>
      <tr className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
        <td className="py-3.5 px-4 text-sm text-ink/40">{level === 0 ? idx + 1 : ''}</td>
        <td className="py-3.5 px-4" style={{ paddingLeft: `${level * 1.5 + 1}rem` }}>
          <span className="text-sm font-semibold text-ink">{cat.name}</span>
        </td>
        <td className="py-3.5 px-4 text-sm text-ink/55">{cat.parent?.name || '-'}</td>
        <td className="py-3.5 px-4 text-sm text-ink/55">{cat.description || '-'}</td>
        <td className="py-3.5 px-4">
          <div className="flex justify-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(cat)}>
              <Edit className="h-4 w-4 text-ink/50" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(cat.id, cat.name)}>
              <Trash2 className="h-4 w-4 text-danger-text" />
            </Button>
          </div>
        </td>
      </tr>
      {children.map((child: any, childIdx: number) => (
        <RenderCategoryRow key={child.id} cat={child} idx={childIdx} categories={categories} onEdit={onEdit} onDelete={onDelete} level={level + 1} />
      ))}
    </>
  );
};

export default CategoriesPage;
