import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Eye, ArrowRightLeft, CornerUpLeft, FileText, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [showReturnHistory, setShowReturnHistory] = useState(false);

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
        setShowReturnHistory(false);
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
      case 'paid': return <Badge variant="success" className="cursor-default">Paid</Badge>;
      case 'partial': return <Badge variant="warning" className="cursor-default">Partial</Badge>;
      case 'due': return <Badge variant="danger" className="cursor-default">Due</Badge>;
      default: return <Badge variant="secondary" className="cursor-default">{status}</Badge>;
    }
  };

  const getReturnActionBadges = (saleId: string) => {
    const history = returnsMap[saleId] || [];
    if (history.length === 0) return null;

    const hasReturn = history.some((h: any) => h.reference === 'Customer Return' || h.reference === 'Customer Return (Damaged)');
    const hasExchange = history.some((h: any) => h.reference === 'Customer Exchange');

    return (
      <div className="flex items-center justify-center gap-1 mt-1 cursor-default select-none">
        {hasReturn && (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 font-normal">
            <CornerUpLeft className="w-2.5 h-2.5 mr-0.5" /> Returned
          </Badge>
        )}
        {hasExchange && (
          <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1.5 py-0 font-normal">
            <ArrowRightLeft className="w-2.5 h-2.5 mr-0.5" /> Exchanged
          </Badge>
        )}
      </div>
    );
  };

  const filteredSales = activeTab === 'returns'
    ? sales.filter(s => (returnsMap[s.id] || []).length > 0)
    : sales;

  const returnedHistory = detailReturns.filter(h => h.reference === 'Customer Return' || h.reference === 'Customer Return (Damaged)');
  const exchangedHistory = detailReturns.filter(h => h.reference === 'Customer Exchange');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Sales</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">View and manage customer invoices</p>
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
                <table className="w-full text-sm select-none">
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
                      <tr key={sale.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors cursor-default">
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
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-ink/10">
            <DialogTitle className="text-lg font-bold">Invoice #{detailSale?.saleNumber}</DialogTitle>
          </DialogHeader>

          {detailSale && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[calc(85vh-120px)]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#faf9f5] p-3 rounded-lg text-xs">
                <div><span className="text-ink/55 block">Invoice #</span><p className="font-mono font-bold">{detailSale.saleNumber}</p></div>
                <div><span className="text-ink/55 block">Date</span><p>{new Date(detailSale.saleDate || detailSale.createdAt).toLocaleDateString()}</p></div>
                <div><span className="text-ink/55 block">Customer</span><p className="font-medium truncate">{detailSale.customer?.name || 'Walk-in'}</p></div>
                <div><span className="text-ink/55 block">Payment</span><p className="capitalize font-medium">{detailSale.paymentMethod}</p></div>
              </div>

              {/* Top Section: Original Invoice Items */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-[#faf9f5] px-3 py-2 border-b text-xs font-bold text-ink/70 flex justify-between items-center">
                  <span>Original Sold Items</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50/50 text-[11px] font-bold text-ink/55">
                      <th className="text-left py-2 px-3">Product Item</th>
                      <th className="text-center py-2 px-2">Qty</th>
                      <th className="text-right py-2 px-3">Price</th>
                      <th className="text-right py-2 px-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailSale.items || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 px-4 text-center text-ink/45 text-xs">
                          No line items found
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

                        // Check if item was returned or exchanged
                        const itemReturns = returnedHistory.filter(h => (h.variant_id || h.variantId) === variantId);
                        
                        // For simplicity, sum all returns from this original variant
                        const totalReturnedQty = itemReturns.reduce((sum, h) => sum + Math.abs(h.quantityChange || 1), 0);
                        const isReturned = totalReturnedQty > 0;
                        const isExchangedItem = exchangedHistory.length > 0 && !isReturned; // Simplistic check if we assume it was exchanged

                        const isAffected = isReturned || isExchangedItem;

                        return (
                          <tr key={item.id} className={`border-b ${isAffected ? 'bg-slate-50/80 text-ink/40' : ''}`}>
                            <td className="py-2.5 px-3">
                              <div className={`font-medium ${isAffected ? 'line-through text-ink/45' : 'text-ink'}`}>
                                {parentName}{variantSuffix}
                              </div>
                              {colorSize && <div className="text-[11px] text-ink/45">{colorSize}</div>}

                              {isReturned && (
                                <div className="mt-1">
                                  <Badge variant="outline" className="bg-amber-100/80 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-normal">
                                    <CornerUpLeft className="w-2.5 h-2.5 mr-1" />
                                    Returned ({totalReturnedQty} qty)
                                  </Badge>
                                </div>
                              )}
                              {!isReturned && isAffected && (
                                <div className="mt-1">
                                  <Badge variant="outline" className="bg-purple-100/80 text-purple-800 border-purple-300 text-[10px] px-1.5 py-0 font-normal">
                                    <ArrowRightLeft className="w-2.5 h-2.5 mr-1" />
                                    Exchanged
                                  </Badge>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-medium">{item.quantity}</td>
                            <td className={`py-2.5 px-3 text-right ${isAffected ? 'line-through text-ink/40' : ''}`}>{formatCurrency(item.unitPrice)}</td>
                            <td className={`py-2.5 px-3 text-right font-semibold ${isAffected ? 'line-through text-ink/40' : ''}`}>
                              {formatCurrency(item.unitPrice * item.quantity)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Section: Expandable Exchanged Items History */}
              {exchangedHistory.length > 0 && (
                <div className="border rounded-lg overflow-hidden bg-purple-50/30">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-xs font-semibold text-purple-900/80 hover:bg-purple-100/50 flex items-center justify-between transition-colors"
                    onClick={() => setShowReturnHistory(prev => !prev)}
                  >
                    <span className="flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
                      Replacement Items Taken by Customer ({exchangedHistory.length} item{exchangedHistory.length > 1 ? 's' : ''})
                    </span>
                    <span className="flex items-center text-purple-900/50 text-[11px]">
                      {showReturnHistory ? 'Collapse' : 'Expand'}
                      {showReturnHistory ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
                    </span>
                  </button>

                  {showReturnHistory && (
                    <div className="border-t border-purple-100 bg-white p-0 text-xs">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-purple-50/40 border-b border-purple-100/80 text-[11px] text-purple-900/60">
                            <th className="text-left py-2 px-3">Replacement Item</th>
                            <th className="text-center py-2 px-2">Qty</th>
                            <th className="text-right py-2 px-3">Price</th>
                            <th className="text-right py-2 px-3">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exchangedHistory.map((ex: any, idx: number) => {
                            const exVar = ex.variant;
                            const parentName = exVar?.parent?.name || exVar?.product?.name || ex.product?.name;
                            const variantName = exVar?.variant_name || exVar?.variantName;
                            const variantSuffix = variantName && variantName !== 'Default' ? ` – ${variantName}` : '';
                            const rawName = parentName ? `${parentName}${variantSuffix}` : (variantName && variantName !== 'Default' ? variantName : null);
                            const exName = rawName || 'Replacement Item';
                            const exColorSize = [exVar?.color, exVar?.size].filter(Boolean).join(' / ');
                            const exQty = Math.abs(ex.quantityChange || 1);

                            // Extract price recorded in notes or from variant / parent price fields
                            const notePriceMatch = ex.notes?.match(/\[Price:\s*NRs\s*([\d.]+)\]/i);
                            const parsedNotePrice = notePriceMatch ? parseFloat(notePriceMatch[1]) : null;
                            const unitPrice =
                              parsedNotePrice ??
                              exVar?.selling_price ??
                              exVar?.sellingPrice ??
                              exVar?.retail_price ??
                              exVar?.parent?.selling_price ??
                              exVar?.parent?.sellingPrice ??
                              exVar?.parent?.retail_price ??
                              0;

                            const displayNotes = ex.notes?.replace(/\[Price:\s*NRs\s*[\d.]+\]/i, '').trim();

                            return (
                              <tr key={`ex-new-${ex.id || idx}`} className="border-b border-purple-50">
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-purple-950 flex items-center gap-1.5">
                                    {exName}
                                  </div>
                                  {exColorSize && <div className="text-[11px] text-purple-700/60">{exColorSize}</div>}
                                  {displayNotes && displayNotes !== 'Given in customer exchange' && (
                                    <div className="text-[10px] text-purple-500 italic mt-0.5">{displayNotes}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold text-purple-900">{exQty}</td>
                                <td className="py-2.5 px-3 text-right text-purple-800">{formatCurrency(unitPrice)}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-purple-900">{formatCurrency(unitPrice * exQty)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Summary */}
              <div className="bg-[#faf9f5] border rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(detailSale.subtotal)}</span></div>
                <div className="flex justify-between"><span>Tax / Discount:</span><span>{formatCurrency(detailSale.taxAmount - detailSale.discountAmount)}</span></div>
                <div className="flex justify-between text-sm font-bold border-t pt-1.5"><span>Invoice Total:</span><span>{formatCurrency(detailSale.totalAmount)}</span></div>

                {detailSale.notes && detailSale.notes.includes('[Return/Exchange:') && (
                  <div className="mt-2 pt-2 border-t text-[11px] text-amber-800 font-mono bg-amber-50/60 p-2 rounded border border-amber-200">
                    {detailSale.notes.split('\n').filter((n: string) => n.includes('[Return/Exchange:')).join('\n')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right-aligned Footer */}
          <div className="p-4 border-t bg-[#faf9f5] flex justify-end items-center">
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold flex items-center gap-1.5"
              onClick={() => setReturnModalOpen(true)}
            >
              <ArrowRightLeft size={14} /> Process Return / Exchange
            </Button>
          </div>
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
