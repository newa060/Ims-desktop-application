import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', password: '', roleId: '', isActive: true };

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await window.electron.getUsers({ page, limit: 20 });
      if (res.success) {
        setUsers(res.data.data);
        setPagination(res.data.pagination);
      } else toast.error('Failed to load users');
    } catch { toast.error('An error occurred'); }
    finally { setLoading(false); }
  }, []);

  const loadRoles = async () => {
    const res = await window.electron.getRoles();
    if (res.success) setRoles(res.data);
  };

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const handleOpenForm = () => {
    loadRoles();
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = { ...formData };
      if (editId && !data.password) delete data.password;
      const res = editId
        ? await window.electron.updateUser(editId, data)
        : await window.electron.createUser(data);
      if (res.success) {
        toast.success(editId ? 'User updated!' : 'User created!');
        loadUsers();
        handleClose();
      } else toast.error(res.error || 'Failed to save user');
    } catch { toast.error('An error occurred'); }
  };

  const handleEdit = (u: any) => {
    setEditId(u.id);
    setFormData({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone || '', password: '', roleId: u.role?.id, isActive: u.isActive });
    setFormOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"?`)) return;
    try {
      const res = await window.electron.deleteUser(id);
      if (res.success) { toast.success('User deleted'); loadUsers(); }
      else toast.error('Failed to delete user');
    } catch { toast.error('An error occurred'); }
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditId(null);
    setFormData(emptyForm);
  };

  const updateField = (field: string, value: any) => setFormData((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Users</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">Manage system users</p>
        </div>
        <Button onClick={handleOpenForm}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Button variant="outline" onClick={() => loadUsers()} className="mb-4"><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-ink/55">No users found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">#</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Name</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Email</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Phone</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Role</th>
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Status</th>
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                        <td className="py-3 px-4">{(pagination.page - 1) * pagination.limit + i + 1}</td>
                        <td className="py-3 px-4 text-sm font-semibold text-ink">{u.firstName} {u.lastName}</td>
                        <td className="py-3 px-4 text-ink/55">{u.email}</td>
                        <td className="py-3 px-4 text-ink/55">{u.phone || '-'}</td>
                        <td className="py-3 px-4"><Badge variant="secondary">{u.role?.name}</Badge></td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(u)}>
                              <Edit className="h-4 w-4 text-ink/50" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(u.id, `${u.firstName} ${u.lastName}`)}>
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
                <span>Total: {pagination.total} user(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => loadUsers(pagination.page - 1)}><ChevronLeft size={16} /></Button>
                  <span className="px-2 py-1">Page {pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadUsers(pagination.page + 1)}><ChevronRight size={16} /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-1">
                <Label>First Name *</Label>
                <Input value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Last Name *</Label>
                <Input value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Password {editId ? '' : '*'}</Label>
                <Input type="password" placeholder={editId ? 'Leave blank to keep current' : ''} value={formData.password} onChange={(e) => updateField('password', e.target.value)} required={!editId} />
              </div>
              <div className="space-y-1">
                <Label>Role *</Label>
                <Select value={formData.roleId} onValueChange={(v) => updateField('roleId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Status</Label>
                <Select value={formData.isActive ? 'active' : 'inactive'} onValueChange={(v) => updateField('isActive', v === 'active')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
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

export default UsersPage;
