import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';

const SalesPage = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailSale, setDetailSale] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadSales = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await window.electron.getSales({ page, limit: 20, search });
      if (res.success) {
        const responseData = res.data;
        // Handle both response formats (wrapped in data or direct)
        if (responseData.data && Array.isArray(responseData.data)) {
          setSales(responseData.data);
          setPagination(responseData.pagination || { page: responseData.page, limit: responseData.limit, total: responseData.total, totalPages: responseData.totalPages });
        } else if (Array.isArray(responseData)) {
          setSales(responseData);
        } else {
          setSales([]);
        }
      } else toast.error('Failed to load sales');
    } catch { toast.error('An error occurred'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadSales(); }, []);

  const viewDetail = async (id: string) => {
    setLoadingDetail(true);
    setDetailOpen(true);
    try {
      const res = await window.electron.getSaleById(id);
      if (res.success) setDetailSale(res.data);
      else toast.error('Failed to load sale details');
    } catch { toast.error('An error occurred'); }
    finally { setLoadingDetail(false); }
  };

  const getPaymentBadge = (status: string) => {
    if (status === 'paid') return <Badge variant="success">Paid</Badge>;
    if (status === 'partial') return <Badge variant="warning">Partial</Badge>;
    return <Badge variant="danger">Unpaid</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-500 mt-1">View all sales transactions</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input placeholder="Search by sale number or customer..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadSales()} className="pl-10" />
            </div>
            <Button variant="outline" onClick={() => loadSales()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No sales found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold">Sale #</th>
                      <th className="text-left py-3 px-4 font-semibold">Customer</th>
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-semibold">Payment</th>
                      <th className="text-right py-3 px-4 font-semibold">Total</th>
                      <th className="text-center py-3 px-4 font-semibold">Status</th>
                      <th className="text-center py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-xs">{sale.saleNumber}</td>
                        <td className="py-3 px-4">{sale.customer?.name || 'Walk-in'}</td>
                        <td className="py-3 px-4 text-gray-500">{new Date(sale.saleDate || sale.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-4 text-gray-500 capitalize">{sale.paymentMethod}</td>
                        <td className="py-3 px-4 text-right font-semibold">${Number(sale.totalAmount).toFixed(2)}</td>
                        <td className="py-3 px-4 text-center">{getPaymentBadge(sale.paymentStatus)}</td>
                        <td className="py-3 px-4 text-center">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => viewDetail(sale.id)}>
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                <span>Total: {pagination.total} sale(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => loadSales(pagination.page - 1)}>
                    <ChevronLeft size={16} />
                  </Button>
                  <span className="px-2 py-1">Page {pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadSales(pagination.page + 1)}>
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) setDetailSale(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : detailSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Sale Number:</span><p className="font-mono font-semibold">{detailSale.saleNumber}</p></div>
                <div><span className="text-gray-500">Date:</span><p>{new Date(detailSale.saleDate || detailSale.createdAt).toLocaleString()}</p></div>
                <div><span className="text-gray-500">Customer:</span><p>{detailSale.customer?.name || 'Walk-in'}</p></div>
                <div><span className="text-gray-500">Payment:</span><p className="capitalize">{detailSale.paymentMethod}</p></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b">
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
                        <td className="py-2 px-4 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                        <td className="py-2 px-4 text-right">${Number(item.totalAmount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal:</span><span>${Number(detailSale.subtotal).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax:</span><span>${Number(detailSale.taxAmount).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Discount:</span><span>-${Number(detailSale.discountAmount).toFixed(2)}</span></div>
                <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total:</span><span>${Number(detailSale.totalAmount).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Paid:</span><span>${Number(detailSale.paidAmount).toFixed(2)}</span></div>
                <div className="flex justify-between text-green-600 font-semibold"><span>Change:</span><span>${Number(detailSale.changeAmount).toFixed(2)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesPage;
