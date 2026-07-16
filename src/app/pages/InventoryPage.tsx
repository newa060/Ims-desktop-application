import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

const InventoryPage = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [lowStockLoading, setLowStockLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [adjForm, setAdjForm] = useState({ productId: '', type: 'addition', quantity: 1, reason: '', notes: '' });

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await window.electron.getInventoryHistory({ page, limit: 20 });
      if (res.success) {
        setHistory(res.data.data);
        setHistoryPagination(res.data.pagination);
      } else toast.error('Failed to load inventory history');
    } catch { toast.error('An error occurred'); }
    finally { setHistoryLoading(false); }
  }, []);

  const loadLowStock = useCallback(async () => {
    setLowStockLoading(true);
    try {
      // Use variant-level low stock (variants:getLowStock merges out-of-stock + low-stock)
      const res = await window.electron.getVariantsLowStock();
      if (res.success) setLowStock(res.data);
      else toast.error('Failed to load low stock items');
    } catch { toast.error('An error occurred'); }
    finally { setLowStockLoading(false); }
  }, []);

  useEffect(() => {
    loadHistory();
    loadLowStock();
  }, []);

  const loadProductsForAdjust = async () => {
    // Load variants instead of products — adjustments operate at variant level
    const res = await window.electron.getVariants({ page: 1, limit: 500 });
    if (res.success) setProducts(res.data.data);
  };

  const handleOpenAdjust = () => {
    loadProductsForAdjust();
    setAdjustOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Pass variantId (stored in adjForm.productId after selecting from variants list)
      const res = await window.electron.adjustInventory({
        variantId: adjForm.productId,   // the Select now holds variantId
        type: adjForm.type,
        quantity: adjForm.quantity,
        reason: adjForm.reason,
        notes: adjForm.notes,
        userId: user?.id,
      });
      if (res.success) {
        toast.success('Stock adjusted successfully!');
        loadHistory();
        loadLowStock();
        setAdjustOpen(false);
        setAdjForm({ productId: '', type: 'addition', quantity: 1, reason: '', notes: '' });
      } else toast.error(res.error || 'Failed to adjust stock');
    } catch { toast.error('An error occurred'); }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, any> = {
      purchase: 'success', sale: 'danger', adjustment: 'warning', return: 'secondary',
    };
    return <Badge variant={variants[type] || 'default'} className="capitalize">{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Inventory</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">Monitor stock levels and adjustments</p>
        </div>
        <Button onClick={handleOpenAdjust}>
          <Settings2 className="mr-2 h-4 w-4" /> Stock Adjustment
        </Button>
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Inventory History</TabsTrigger>
          <TabsTrigger value="lowstock">
            Low Stock
            {lowStock.length > 0 && <span className="ml-1 bg-danger-text text-white text-xs rounded-full px-1.5">{lowStock.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3 mb-4">
                <Button variant="outline" onClick={() => loadHistory()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
              </div>
              {historyLoading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-ink/55">No inventory history found</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                          <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Date</th>
                          <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Product</th>
                          <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Type</th>
                          <th className="text-right py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Before</th>
                          <th className="text-right py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Change</th>
                          <th className="text-right py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">After</th>
                          <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h) => (
                          <tr key={h.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                            <td className="py-3 px-4 text-ink/55">{new Date(h.createdAt).toLocaleString()}</td>
                            <td className="py-3 px-4">
                              <div className="font-medium">
                                {h.product?.name ?? '—'}
                              </div>
                              <div className="text-xs text-ink/35">
                                {h.variant
                                  ? `${h.variant.variant_name !== 'Default' ? h.variant.variant_name + ' · ' : ''}${h.variant.sku}`
                                  : (h.product?.sku ?? '')}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">{getTypeBadge(h.type)}</td>
                            <td className="py-3 px-4 text-right">{h.quantityBefore}</td>
                            <td className={`py-3 px-4 text-right font-semibold ${h.quantityChange > 0 ? 'text-success-text' : 'text-danger-text'}`}>
                              {h.quantityChange > 0 ? '+' : ''}{h.quantityChange}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold">{h.quantityAfter}</td>
                            <td className="py-3 px-4 text-ink/55 text-xs">{h.reference}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between mt-4 text-sm text-ink/55">
                    <span>Total: {historyPagination.total} record(s)</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={historyPagination.page <= 1} onClick={() => loadHistory(historyPagination.page - 1)}><ChevronLeft size={16} /></Button>
                      <span className="px-2 py-1">Page {historyPagination.page} / {historyPagination.totalPages}</span>
                      <Button variant="outline" size="sm" disabled={historyPagination.page >= historyPagination.totalPages} onClick={() => loadHistory(historyPagination.page + 1)}><ChevronRight size={16} /></Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lowstock">
          <Card>
            <CardContent className="pt-6">
              <Button variant="outline" onClick={loadLowStock} className="mb-4"><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
              {lowStockLoading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
              ) : lowStock.length === 0 ? (
                <div className="text-center py-12 text-ink/55">
                  <p className="text-lg font-medium text-success-text">All products are well-stocked!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                        <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Product</th>
                        <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Variant</th>
                        <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">SKU</th>
                        <th className="text-right py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Current Stock</th>
                        <th className="text-right py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Low Stock Limit</th>
                        <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStock.map((v) => (
                        <tr key={v.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                          <td className="py-3 px-4 font-medium">{v.parent?.name ?? v.productName ?? '—'}</td>
                          <td className="py-3 px-4 text-ink/55">{v.variantName || 'Default'}</td>
                          <td className="py-3 px-4 font-mono text-xs text-ink/55">{v.sku}</td>
                          <td className="py-3 px-4 text-right font-bold text-danger-text">{v.stock}</td>
                          <td className="py-3 px-4 text-right text-ink/55">{v.minimumStock}</td>
                          <td className="py-3 px-4 text-center">
                            {v.stock === 0
                              ? <Badge variant="danger"><AlertTriangle size={12} className="mr-1 inline" />Out of Stock</Badge>
                              : <Badge variant="warning">Low Stock</Badge>
                            }                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={adjustOpen} onOpenChange={(o) => { setAdjustOpen(o); if (!o) setAdjForm({ productId: '', type: 'addition', quantity: 1, reason: '', notes: '' }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock Adjustment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjustSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label>Product Variant *</Label>
                <Select value={adjForm.productId} onValueChange={(v) => setAdjForm({ ...adjForm, productId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => {
                      const productName = p.parent?.name ?? p.productName ?? '';
                      const variantLabel = p.variantName && p.variantName !== 'Default'
                        ? ` – ${p.variantName}` : '';
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {productName}{variantLabel} (Stock: {p.stock ?? 0})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Adjustment Type *</Label>
                  <Select value={adjForm.type} onValueChange={(v) => setAdjForm({ ...adjForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="addition">Addition (Stock In)</SelectItem>
                      <SelectItem value="subtraction">Subtraction (Stock Out)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Quantity *</Label>
                  <Input type="number" min="1" value={adjForm.quantity} onChange={(e) => setAdjForm({ ...adjForm, quantity: parseInt(e.target.value) || 1 })} required />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Reason *</Label>
                <Input placeholder="e.g. Damage, Return, Count correction" value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea rows={2} value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
              <Button type="submit">Apply Adjustment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryPage;
