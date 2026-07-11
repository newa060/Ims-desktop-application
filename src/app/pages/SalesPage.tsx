import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';

const SalesPage = () => {
  const { formatCurrency } = useSettings();
  const [sales, setSales] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailSale, setDetailSale] = useState<any>(null);

  const loadSales = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await window.electron.getSales({ page, limit: 20, search });
      if (res.success) {
        setSales(res.data.data);
        setPagination(res.data.pagination);
      } else toast.error('Failed to load sales');
    } catch { toast.error('An error occurred'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadSales(); }, []);

  const viewDetail = async (id: string) => {
    try {
      const res = await window.electron.getSaleById(id);
      if (res.success) setDetailSale(res.data);
      else toast.error('Failed to load sale details');
    } catch { toast.error('An error occurred'); }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge variant="success">Paid</Badge>;
      case 'partial': return <Badge variant="warning">Partial</Badge>;
      case 'due': return <Badge variant="danger">Due</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Sales</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">View and manage customer invoices</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={18} />
              <Input placeholder="Search invoice number..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadSales()} className="pl-10" />
            </div>
            <Button variant="outline" onClick={() => loadSales()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12 text-ink/55">No sales found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Invoice #</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Customer</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Date</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Payment Method</th>
                      <th className="text-right py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Total Amount</th>
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Status</th>
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-ink/60">{sale.saleNumber}</td>
                        <td className="py-3 px-4">{sale.customer?.name || 'Walk-in'}</td>
                        <td className="py-3 px-4 text-ink/55">{new Date(sale.saleDate || sale.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-4 text-ink/55 capitalize">{sale.paymentMethod}</td>
                        <td className="py-3 px-4 text-right font-bold text-ink">{formatCurrency(sale.totalAmount)}</td>
                        <td className="py-3 px-4 text-center">{getPaymentBadge(sale.paymentStatus)}</td>
                        <td className="py-3 px-4 text-center">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => viewDetail(sale.id)}>
                            <Eye className="h-4 w-4 text-ink/50" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 text-sm text-ink/55">
                <span>Total: {pagination.total} sale(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => loadSales(pagination.page - 1)}><ChevronLeft size={16} /></Button>
                  <span className="px-2 py-1">Page {pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadSales(pagination.page + 1)}><ChevronRight size={16} /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailSale} onOpenChange={(o) => !o && setDetailSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invoice Details</DialogTitle></DialogHeader>
          {detailSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-ink/55">Invoice Number:</span><p className="font-mono font-semibold">{detailSale.saleNumber}</p></div>
                <div><span className="text-ink/55">Date:</span><p>{new Date(detailSale.saleDate || detailSale.createdAt).toLocaleString()}</p></div>
                <div><span className="text-ink/55">Customer:</span><p className="font-semibold">{detailSale.customer?.name || 'Walk-in'}</p></div>
                <div><span className="text-ink/55">Payment:</span><p className="capitalize">{detailSale.paymentMethod}</p></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[#faf9f5] border-b">
                    <th className="text-left py-2 px-4">Product</th>
                    <th className="text-center py-2 px-4">Qty</th>
                    <th className="text-right py-2 px-4">Price</th>
                    <th className="text-right py-2 px-4">Total</th>
                  </tr></thead>
                  <tbody>
                    {(detailSale.items || []).map((item: any) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2 px-4">{item.product?.name}</td>
                        <td className="py-2 px-4 text-center">{item.quantity}</td>
                        <td className="py-2 px-4 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 px-4 text-right">{formatCurrency(item.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(detailSale.subtotal)}</span></div>
                <div className="flex justify-between"><span>Tax:</span><span>{formatCurrency(detailSale.taxAmount)}</span></div>
                <div className="flex justify-between"><span>Discount:</span><span>-{formatCurrency(detailSale.discountAmount)}</span></div>
                <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total:</span><span>{formatCurrency(detailSale.totalAmount)}</span></div>
                <div className="flex justify-between"><span>Paid:</span><span>{formatCurrency(detailSale.paidAmount)}</span></div>
                <div className="flex justify-between text-success-text font-semibold"><span>Change:</span><span>{formatCurrency(detailSale.changeAmount)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesPage;
