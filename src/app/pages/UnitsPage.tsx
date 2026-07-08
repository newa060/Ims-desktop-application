import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const UnitsPage = () => {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', shortName: '' });
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const res = await window.electron.getUnits();
      if (res.success) setUnits(res.data);
      else toast.error('Failed to load units');
    } catch { toast.error('An error occurred'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = editId
        ? await window.electron.updateUnit(editId, formData)
        : await window.electron.createUnit(formData);
      if (res.success) {
        toast.success(editId ? 'Unit updated!' : 'Unit created!');
        loadUnits();
        handleClose();
      } else toast.error(res.error || 'Failed to save unit');
    } catch { toast.error('An error occurred'); }
  };

  const handleEdit = (unit: any) => {
    setEditId(unit.id);
    setFormData({ name: unit.name, shortName: unit.shortName });
    setFormOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete unit "${name}"?`)) return;
    try {
      const res = await window.electron.deleteUnit(id);
      if (res.success) { toast.success('Unit deleted'); loadUnits(); }
      else toast.error('Failed to delete unit');
    } catch { toast.error('An error occurred'); }
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditId(null);
    setFormData({ name: '', shortName: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Units</h1>
          <p className="text-gray-500 mt-1">Manage measurement units</p>
        </div>
        <Button onClick={() => { setEditId(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Unit
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Button variant="outline" onClick={loadUnits} className="mb-4">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No units found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold">#</th>
                    <th className="text-left py-3 px-4 font-semibold">Unit Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Short Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Products</th>
                    <th className="text-center py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit, i) => (
                    <tr key={unit.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{i + 1}</td>
                      <td className="py-3 px-4 font-medium">{unit.name}</td>
                      <td className="py-3 px-4 text-gray-600 font-mono">{unit.shortName}</td>
                      <td className="py-3 px-4 text-gray-500">{unit._count?.products ?? (unit.products?.length ?? 0)}</td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(unit)}>
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(unit.id, unit.name)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
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
            <DialogTitle>{editId ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label>Unit Name *</Label>
                <Input placeholder="e.g. Kilogram" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Short Name *</Label>
                <Input placeholder="e.g. kg" value={formData.shortName} onChange={(e) => setFormData({ ...formData, shortName: e.target.value })} required />
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

export default UnitsPage;
