import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Plus, Search, RefreshCw, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
}

const PurchasesPage = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const loadPurchases = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await window.electron.getPurchases({ page, limit: 20, search });
      if (res.success) {
        setPurchases(res.data.data);
        setPagination(res.data.pagination);
      } else toast.error('Failed to load purchases');
    } catch { toast.error('An error occurred'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadPurchases(); }, []);

  const loadFormData = async () => {
    try {
      const [s, p] = await Promise.all([
        window.electron.getSuppliers({ page: 1, limit: 100 }),
        window.electron.getProducts({ page: 1, limit: 500 }),
      ]);
      if (s.success) setSuppliers(s.data.data);
      if (p.success) setProducts(p.data.data);
    } catch { toast.error('Failed to load form data'); }
  };

  const handleOpenForm = () => {
    loadFormData();
    setFormOpen(true);
  };

  const handleAddItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, unitPrice: 0, taxRate: 0, discountAmount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'productId') {
      const prod = products.find((p) => p.id === value);
      newItems[index] = { ...newItems[index], productId: value, productName: prod?.name || '', unitPrice: prod?.purchasePrice || 0 };
    } else {
      (newItems[index] as any)[field] = value;
    }
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return toast.error('Add at least one item');
    if (!items.every((it) => it.productId)) return toast.error('Select product for all items');
    try {
      const res = await window.electron.createPurchase({
        supplierId,
        userId: user?.id,
        items,
        paymentMethod,
        paidAmount,
      });
      if (res.success) {
        toast.success('Purchase created!');
        loadPurchases();
        handleClose();
      } else toast.error(res.error || 'Failed to create purchase');
    } catch { toast.error('An error occurred'); }
  };

  const handleClose = () => {
    setFormOpen(false);
    setSupplierId('');
    setPaymentMethod('cash');
    setPaidAmount(0);
    setItems([]);
  };

  const subtotal = items.reduce((sum, it) => sum + (it.quantity * it.unitPrice - it.discountAmount), 0);
  const totalTax = items.reduce((sum, it) => sum + ((it.quantity * it.unitPrice - it.discountAmount) * it.taxRate / 100), 0);
  const total = subtotal + totalTax;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Purchases</h1>
          <p className="text-gray-500 mt-1">Manage your inventory purchases</p>
        </div>
        <Button onClick={handleOpenForm}>
          <Plus className="mr-2 h-4 w-4" /> Create Purchase
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input placeholder="Search purchases..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadPurchases()} className="pl-10" />
            </div>
            <Button variant="outline" onClick={() => loadPurchases()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No purchases found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold">Purchase #</th>
                      <th className="text-left py-3 px-4 font-semibold">Supplier</th>
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-right py-3 px-4 font-semibold">Total</th>
                      <th className="text-center py-3 px-4 font-semibold">Payment Status</th>
                      <th className="text-center py-3 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-xs">{p.purchaseNumber}</td>
                        <td className="py-3 px-4 font-medium">{p.supplier.name}</td>
                        <td className="py-3 px-4 text-gray-500">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right font-semibold">${Number(p.totalAmount).toFixed(2)}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={p.paymentStatus === 'paid' ? 'success' : p.paymentStatus === 'partial' ? 'warning' : 'danger'}>{p.paymentStatus}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={p.status === 'received' ? 'success' : 'default'}>{p.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                <span>Total: {pagination.total} purchase(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => loadPurchases(pagination.page - 1)}>
                    <ChevronLeft size={16} />
                  </Button>
                  <span className="px-2 py-1">Page {pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadPurchases(pagination.page + 1)}>
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Supplier *</Label>
                  <Select value={supplierId} onValueChange={setSupplierId} required>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold">Items</h3>
                  <Button type="button" size="sm" onClick={handleAddItem}><Plus size={16} className="mr-1" /> Add Item</Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-2">
                      <div className="col-span-4">
                        <Label className="text-xs">Product</Label>
                        <Select value={item.productId} onValueChange={(v) => updateItem(idx, 'productId', v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min="1" className="h-9" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 1)} />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Price</Label>
                        <Input type="number" step="0.01" min="0" className="h-9" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Tax %</Label>
                        <Input type="number" step="0.01" min="0" className="h-9" value={item.taxRate} onChange={(e) => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-1">
                        <Button type="button" size="icon" variant="ghost" className="h-9 w-9" onClick={() => handleRemoveItem(idx)}>
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="space-y-2">
                  <div className="flex justify-between"><span>Subtotal:</span><span className="font-semibold">${subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Tax:</span><span className="font-semibold">${totalTax.toFixed(2)}</span></div>
                  <div className="flex justify-between text-lg border-t pt-2"><span className="font-bold">Total:</span><span className="font-bold text-primary">${total.toFixed(2)}</span></div>
                  <div className="space-y-1 pt-2">
                    <Label>Amount Paid</Label>
                    <Input type="number" step="0.01" min="0" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit">Create Purchase</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchasesPage;
