import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Eye, ArrowRightLeft, CornerUpLeft, FileText, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { SaleReturnModal } from './SaleReturnModal';

const SalesPage = () => {
  const { formatCurrency } = useSettings();
  const [sales, setSales] = useState<any[]>([]);
  const [returnsMap, setReturnsMap] = useState<Record<string, any[]>>({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'returns'>('all');
  const [detailSale, setDetailSale] = useState<any>(null);
  const [detailReturns, setDetailReturns] = useState<any[]>([]);
  const [returnModalOpen, setReturnModalOpen] = useState(false);

  const loadSales = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await window.electron.getSales({ page, limit: 20, search });
      if (res.success) {
        const loadedSales = res.data.data || [];
        setSales(loadedSales);
        setPagination({
          page: res.data.page || 1,
          limit: res.data.limit || 20,
          total: res.data.total || 0,
          totalPages: res.data.totalPages || 1
        });

        // Batch load return/exchange history for loaded sales
        if (loadedSales.length > 0 && window.electron?.getSaleReturnsBatch) {
          const saleIds = loadedSales.map((s: any) => s.id);
          const retRes = await window.electron.getSaleReturnsBatch(saleIds);
          if (retRes.success) {
            setReturnsMap(retRes.data || {});
          }
        }
      } else {
        toast.error('Failed to load sales');
      }
    } catch {
      toast.error('An error occurred while fetching sales');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadSales(); }, []);

  const viewDetail = async (id: string) => {
    try {
      const res = await window.electron.getSaleById(id);
      if (res.success) {
        setDetailSale(res.data);
        if (window.electron?.getSaleReturnsBatch) {
          const retRes = await window.electron.getSaleReturnsBatch([id]);
          if (retRes.success && retRes.data) {
            setDetailReturns(retRes.data[id] || []);
          } else {
            setDetailReturns([]);
          }
        }
      } else toast.error('Failed to load sale details');
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

  const getReturnActionBadges = (saleId: string) => {
    const history = returnsMap[saleId] || [];
    if (history.length === 0) return null;

    const hasReturn = history.some((h: any) => h.reference === 'Customer Return' || h.reference === 'Customer Return (Damaged)');
    const hasExchange = history.some((h: any) => h.reference === 'Customer Exchange');

    return (
      <div className="flex items-center justify-center gap-1 mt-1">
        {hasReturn && (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0">
            <CornerUpLeft className="w-2.5 h-2.5 mr-0.5" /> Returned
          </Badge>
        )}
        {hasExchange && (
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] px-1.5 py-0">
            <ArrowRightLeft className="w-2.5 h-2.5 mr-0.5" /> Exchanged
          </Badge>
        )}
      </div>
    );
  };

  // Filter sales if activeTab === 'returns'
  const filteredSales = activeTab === 'returns'
    ? sales.filter(s => (returnsMap[s.id] || []).length > 0)
    : sales;

  // Compute return & exchange summary details for detailSale modal
  const returnedHistory = detailReturns.filter(h => h.reference === 'Customer Return' || h.reference === 'Customer Return (Damaged)');
  const exchangedHistory = detailReturns.filter(h => h.reference === 'Customer Exchange');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Sales</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">View and manage customer invoices, returns & exchanges</p>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex border-b border-ink/10 gap-2">
        <button
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-ink/60 hover:text-ink'
          }`}
          onClick={() => setActiveTab('all')}
        >
          <FileText className="w-4 h-4" /> All Sales Invoices
        </button>
        <button
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'returns'
              ? 'border-primary text-primary'
              : 'border-transparent text-ink/60 hover:text-ink'
          }`}
          onClick={() => setActiveTab('returns')}
        >
          <ArrowRightLeft className="w-4 h-4" /> Returns & Exchanges Report
          {Object.keys(returnsMap).filter(k => returnsMap[k].length > 0).length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold">
              {Object.keys(returnsMap).filter(k => returnsMap[k].length > 0).length}
            </span>
          )}
        </button>
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
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 text-ink/55">
              {activeTab === 'returns' ? 'No return or exchange records found' : 'No sales found'}
            </div>
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
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Status / Activity</th>
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-ink/60">{sale.saleNumber}</td>
                        <td className="py-3 px-4">{sale.customer?.name || 'Walk-in'}</td>
                        <td className="py-3 px-4 text-ink/55">{new Date(sale.saleDate || sale.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-4 text-ink/55 capitalize">{sale.paymentMethod}</td>
                        <td className="py-3 px-4 text-right font-bold text-ink">{formatCurrency(sale.totalAmount)}</td>
                        <td className="py-3 px-4 text-center">
                          {getPaymentBadge(sale.paymentStatus)}
                          {getReturnActionBadges(sale.id)}
                        </td>
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
                <span>Showing {filteredSales.length} of {pagination.total} sale(s)</span>
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

      {/* Invoice Detail Dialog */}
      <Dialog open={!!detailSale} onOpenChange={(o) => !o && setDetailSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="text-xl font-bold">Invoice Details & Return History</DialogTitle></DialogHeader>
          {detailSale && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#faf9f5] p-3 rounded-lg text-xs">
                <div><span className="text-ink/55 block">Invoice Number</span><p className="font-mono font-bold text-sm">{detailSale.saleNumber}</p></div>
                <div><span className="text-ink/55 block">Date</span><p className="font-medium">{new Date(detailSale.saleDate || detailSale.createdAt).toLocaleString()}</p></div>
                <div><span className="text-ink/55 block">Customer</span><p className="font-medium">{detailSale.customer?.name || 'Walk-in'}</p></div>
                <div><span className="text-ink/55 block">Payment Method</span><p className="font-medium capitalize">{detailSale.paymentMethod}</p></div>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#faf9f5] border-b text-xs font-bold text-ink/60">
                      <th className="text-left py-2.5 px-4">Item & Action Status</th>
                      <th className="text-center py-2.5 px-4">Sold Qty</th>
                      <th className="text-right py-2.5 px-4">Unit Price</th>
                      <th className="text-right py-2.5 px-4">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailSale.items || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 px-4 text-center text-ink/45 text-sm">
                          No line items found for this sale
                        </td>
                      </tr>
                    ) : (
                      (detailSale.items || []).map((item: any) => {
                        const v = item.variant;
                        const variantId = item.variantId || item.variant_id;
                        const parentName =
                          v?.parent?.name ??
                          v?.product?.name ??
                          item.product?.name ??
                          '—';
                        const variantName = v?.variant_name ?? v?.variantName;
                        const variantSuffix =
                          variantName && variantName !== 'Default' ? ` – ${variantName}` : '';
                        const colorSize = [v?.color, v?.size].filter(Boolean).join(' / ');
                        const sku = v?.sku ?? item.sku;

                        // Calculate returns for this line item
                        const itemReturns = returnedHistory.filter(h => (h.variant_id || h.variantId) === variantId);
                        const totalReturnedQty = itemReturns.reduce((sum, h) => sum + Math.abs(h.quantityChange || 1), 0);
                        const isDamaged = itemReturns.some(h => h.reference === 'Customer Return (Damaged)');

                        return (
                          <React.Fragment key={item.id}>
                            <tr className={`border-b ${totalReturnedQty > 0 ? 'bg-amber-50/30' : ''}`}>
                              <td className="py-3 px-4">
                                <div className="font-medium text-ink">{parentName}{variantSuffix}</div>
                                {colorSize && <div className="text-xs text-ink/50">{colorSize}</div>}
                                {sku && <div className="text-xs text-ink/45 font-mono">{sku}</div>}

                                {totalReturnedQty > 0 && (
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <Badge variant="outline" className="bg-amber-100/80 text-amber-800 border-amber-300 text-[11px]">
                                      <CornerUpLeft className="w-3 h-3 mr-1" />
                                      Returned: {totalReturnedQty} {isDamaged ? '(Damaged)' : '(Resellable)'}
                                    </Badge>
                                    {itemReturns[0]?.notes && (
                                      <span className="text-[11px] text-amber-700 italic">"{itemReturns[0].notes}"</span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center font-medium">{item.quantity}</td>
                              <td className="py-3 px-4 text-right">{formatCurrency(item.unitPrice)}</td>
                              <td className="py-3 px-4 text-right font-semibold">{formatCurrency(item.totalAmount)}</td>
                            </tr>
                          </React.Fragment>
                        );
                      })
                    )}

                    {/* Exchanged Items Section (rendered below original items) */}
                    {exchangedHistory.length > 0 && (
                      <>
                        <tr className="bg-purple-100/60 border-y border-purple-200">
                          <td colSpan={4} className="py-2 px-4 text-xs font-bold text-purple-900 flex items-center gap-1.5">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-purple-700" />
                            Exchanged Replacement Items (Issued to Customer):
                          </td>
                        </tr>
                        {exchangedHistory.map((ex: any, idx: number) => {
                          const exVar = ex.variant;
                          const exName = exVar?.parent?.name 
                            ? `${exVar.parent.name}${exVar.variant_name ? ` – ${exVar.variant_name}` : ''}`
                            : (exVar?.variant_name || 'Replacement Item');
                          const exColorSize = [exVar?.color, exVar?.size].filter(Boolean).join(' / ');
                          const exQty = Math.abs(ex.quantityChange || 1);
                          return (
                            <tr key={ex.id || idx} className="bg-purple-50/40 border-b border-purple-100 text-xs">
                              <td className="py-2.5 px-6">
                                <div className="font-semibold text-purple-950 flex items-center gap-1.5">
                                  <span>⇄ {exName}</span>
                                  <Badge className="bg-purple-200 text-purple-800 border-none text-[10px] px-1 py-0">Issued</Badge>
                                </div>
                                {exColorSize && <div className="text-purple-700/70">{exColorSize}</div>}
                                {ex.notes && <div className="text-purple-600 italic mt-0.5">{ex.notes}</div>}
                              </td>
                              <td className="py-2.5 px-4 text-center font-bold text-purple-900">{exQty}</td>
                              <td className="py-2.5 px-4 text-right text-purple-700">{formatCurrency(exVar?.retail_price || 0)}</td>
                              <td className="py-2.5 px-4 text-right font-bold text-purple-900">{formatCurrency((exVar?.retail_price || 0) * exQty)}</td>
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payment Summary & Changes Breakdown */}
              <div className="bg-[#faf9f5] border rounded-lg p-3.5 space-y-2 text-sm">
                <h4 className="font-bold text-xs uppercase tracking-wider text-ink/50 border-b pb-1">Payment & Adjustment Summary</h4>
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(detailSale.subtotal)}</span></div>
                <div className="flex justify-between"><span>Tax:</span><span>{formatCurrency(detailSale.taxAmount)}</span></div>
                <div className="flex justify-between"><span>Discount:</span><span>-{formatCurrency(detailSale.discountAmount)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-1.5"><span>Original Invoice Total:</span><span>{formatCurrency(detailSale.totalAmount)}</span></div>

                {detailReturns.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-ink/10 space-y-1 text-xs bg-amber-50/50 p-2.5 rounded border border-amber-200">
                    <div className="font-semibold text-amber-900 mb-1 flex items-center gap-1">
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Return & Exchange Payment Adjustments
                    </div>
                    {detailSale.notes && detailSale.notes.includes('[Return/Exchange:') && (
                      <div className="text-amber-800 font-mono text-[11.5px] bg-white/80 p-1.5 rounded border border-amber-200/60 mb-1">
                        {detailSale.notes.split('\n').filter((n: string) => n.includes('[Return/Exchange:')).join('\n')}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between text-ink/70 pt-1"><span>Amount Paid:</span><span>{formatCurrency(detailSale.paidAmount)}</span></div>
                <div className="flex justify-between font-semibold text-success-text"><span>Change Given:</span><span>{formatCurrency(detailSale.changeAmount)}</span></div>
              </div>

              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  className="w-full text-xs font-semibold flex items-center justify-center gap-2 py-5"
                  onClick={() => setReturnModalOpen(true)}
                >
                  <ArrowRightLeft size={16} /> Process Return or Exchange
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {detailSale && (
        <SaleReturnModal
          open={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          onSuccess={async () => {
            loadSales(pagination.page);
            const updated = await window.electron.getSaleById(detailSale.id);
            if (updated.success) setDetailSale(updated.data);
            if (window.electron?.getSaleReturnsBatch) {
              const retRes = await window.electron.getSaleReturnsBatch([detailSale.id]);
              if (retRes.success && retRes.data) setDetailReturns(retRes.data[detailSale.id] || []);
            }
          }}
          sale={detailSale}
        />
      )}
    </div>
  );
};

export default SalesPage;
