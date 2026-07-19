import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { ChevronDown, ChevronUp, AlertCircle, Package, Filter, X, DollarSign } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { formatDate } from '../../utils/date';

interface SupplierReportModalProps {
  supplier: any;
  open: boolean;
  onClose: () => void;
}

export const SupplierReportModal = ({ supplier, open, onClose }: SupplierReportModalProps) => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPurchases, setExpandedPurchases] = useState<Record<string, boolean>>({});
  const [returnsMap, setReturnsMap] = useState<Record<string, any[]>>({});
  const [currentBalance, setCurrentBalance] = useState<number>(0);

  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Balance Payment Form State
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payForPurchase, setPayForPurchase] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Refund / Exchange State
  const [refundExchangeDialogOpen, setRefundExchangeDialogOpen] = useState(false);
  const [activePurchaseId, setActivePurchaseId] = useState<string | null>(null);
  const [activePurchaseItems, setActivePurchaseItems] = useState<any[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');   // replaces selectedProductId
  const [refundExchangeQty, setRefundExchangeQty] = useState<number>(1);
  const [actionType, setActionType] = useState<'refund' | 'exchange'>('refund');
  const [refundExchangeNotes, setRefundExchangeNotes] = useState<string>('');
  const [isSubmittingRefundExchange, setIsSubmittingRefundExchange] = useState(false);

  const loadReportData = useCallback(async () => {
    if (!supplier?.id) return;
    setLoading(true);
    try {
      // ── Fetch purchases ─────────────────────────────────────────────────────
      const res = await window.electron.getPurchases({ supplierId: supplier.id, limit: 100 });
      if (!res.success) {
        toast.error('Failed to load supplier report');
        return;
      }
      setPurchases(res.data.data);

      // ── Fetch live supplier balance (Fix #1: avoid stale prop) ───────────────
      const supRes = await window.electron.getSupplierById(supplier.id);
      if (supRes.success && supRes.data) {
        setCurrentBalance(Number(supRes.data.balance || 0));
      } else {
        setCurrentBalance(Number(supplier?.balance || 0));
      }

      // ── Batch-fetch all returns in ONE query (Fix #2: no N+1) ───────────────
      const allPurchaseIds: string[] = res.data.data.map((p: any) => p.id);
      const retRes = await window.electron.getPurchaseReturnsBatch(allPurchaseIds);
      if (retRes.success) {
        const pReturns: Record<string, any[]> = {};
        for (const r of retRes.data) {
          if (!pReturns[r.referenceId]) pReturns[r.referenceId] = [];
          pReturns[r.referenceId].push(r);
        }
        setReturnsMap(pReturns);
      }
    } catch {
      toast.error('An error occurred loading the report');
    } finally {
      setLoading(false);
    }
  }, [supplier]);

  useEffect(() => {
    if (open) {
      loadReportData();
    } else {
      setExpandedPurchases({});
      setReturnsMap({});
    }
  }, [open, loadReportData]);

  const toggleExpand = (purchaseId: string) => {
    setExpandedPurchases((prev) => ({ ...prev, [purchaseId]: !prev[purchaseId] }));
  };

  const getRefundedQty = (purchaseId: string, variantId: string) => {
    const records = returnsMap[purchaseId] || [];
    return records
      .filter((r) =>
        (r.variant_id === variantId || r.variantId === variantId) &&
        (r.reference === 'Purchase Refund' || r.reference === 'Purchase Return' || r.type === 'refund')
      )
      .reduce((sum, r) => sum + Math.abs(r.quantityChange), 0);
  };

  const getExchangedQty = (purchaseId: string, variantId: string) => {
    const records = returnsMap[purchaseId] || [];
    return records
      .filter((r) =>
        (r.variant_id === variantId || r.variantId === variantId) &&
        r.reference === 'Purchase Exchange' && r.quantityChange < 0
      )
      .reduce((sum, r) => sum + Math.abs(r.quantityChange), 0);
  };

  // --- Refund / Exchange ---
  const handleOpenRefundExchangeDialog = (purchase: any) => {
    setActivePurchaseId(purchase.id);
    setActivePurchaseItems(purchase.items || []);
    // Use variant_id (new) falling back to productId (old rows)
    if (purchase.items && purchase.items.length > 0) {
      setSelectedVariantId(purchase.items[0].variant_id || purchase.items[0].variantId || '');
    } else {
      setSelectedVariantId('');
    }
    setRefundExchangeQty(1);
    setActionType('refund');
    setRefundExchangeNotes('');
    setRefundExchangeDialogOpen(true);
  };

  const handleSubmitRefundExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePurchaseId || !selectedVariantId) return;

    const item = activePurchaseItems.find(
      (i) => (i.variant_id || i.variantId) === selectedVariantId
    );
    if (!item) return;

    const alreadyRefunded  = getRefundedQty(activePurchaseId, selectedVariantId);
    const alreadyExchanged = getExchangedQty(activePurchaseId, selectedVariantId);
    const maxQty = item.quantity - (alreadyRefunded + alreadyExchanged);

    if (refundExchangeQty <= 0 || refundExchangeQty > maxQty) {
      toast.error(`Quantity must be between 1 and ${maxQty}.`);
      return;
    }

    setIsSubmittingRefundExchange(true);
    try {
      const res = await window.electron.createPurchaseRefundOrExchange({
        purchaseId:    activePurchaseId,
        variantId:     selectedVariantId,
        productFlatId: item.productId,   // product_variant_flat.id
        quantity:      refundExchangeQty,
        actionType,
        notes: refundExchangeNotes || `${actionType === 'refund' ? 'Refunded' : 'Exchanged'} units`,
      });
      if (res.success) {
        toast.success(`${actionType === 'refund' ? 'Refund' : 'Exchange'} processed successfully`);
        setRefundExchangeDialogOpen(false);
        loadReportData();
      } else {
        toast.error(res.error || `Failed to process ${actionType}`);
      }
    } catch (err: any) {
      toast.error(`An error occurred: ${err?.message || err}`);
    } finally {
      setIsSubmittingRefundExchange(false);
    }
  };

  // --- Balance Payment ---
  const handleOpenPayDialog = (purchase: any) => {
    setPayForPurchase(purchase);
    setPayAmount(Number(purchase.balanceAmount || 0));
    setPayDialogOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForPurchase || payAmount <= 0) return;
    setIsSubmittingPayment(true);
    try {
      const res = await window.electron.recordPurchasePayment({
        purchaseId: payForPurchase.id,
        amount: payAmount,
      });
      if (res.success) {
        toast.success(`Payment of $${payAmount.toFixed(2)} recorded. Status: ${res.data.newPaymentStatus}`);
        setPayDialogOpen(false);
        setPayForPurchase(null);
        loadReportData();
      } else {
        toast.error(res.error || 'Failed to record payment');
      }
    } catch {
      toast.error('An error occurred recording the payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // --- Filtering ---
  const filteredPurchases = purchases.filter((p) => {
    if (statusFilter !== 'all' && p.paymentStatus !== statusFilter) return false;
    if (startDate) {
      const pDate = new Date(p.purchaseDate);
      const sd = new Date(startDate); sd.setHours(0, 0, 0, 0);
      if (pDate < sd) return false;
    }
    if (endDate) {
      const pDate = new Date(p.purchaseDate);
      const ed = new Date(endDate); ed.setHours(23, 59, 59, 999);
      if (pDate > ed) return false;
    }
    return true;
  });

  const activeFilterCount = [statusFilter !== 'all', !!startDate, !!endDate].filter(Boolean).length;
  const clearFilters = () => { setStatusFilter('all'); setStartDate(''); setEndDate(''); };

  const activeItemDetails = activePurchaseItems.find(
    (i) => (i.variant_id || i.variantId) === selectedVariantId
  );
  const activeProductIdMaxQty = activeItemDetails
    ? activeItemDetails.quantity - (
        getRefundedQty(activePurchaseId || '', selectedVariantId) +
        getExchangedQty(activePurchaseId || '', selectedVariantId)
      )
    : 0;

  // Group purchases by date
  const groupedPurchases = filteredPurchases.reduce<Record<string, any[]>>((groups, purchase) => {
    const dateKey = formatDate(purchase.purchaseDate);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(purchase);
    return groups;
  }, {});

  // Sort dates descending
  const sortedDates = Object.keys(groupedPurchases).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <>
      {/* ── Main Report Dialog ── */}
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-4 border-b border-ink/[0.08]">
            <div className="flex items-start gap-4 pr-8">
              {/* pr-8 keeps the Radix close (×) button from overlapping */}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl font-bold flex flex-wrap items-center gap-2">
                  <span>Transactions, Refunds &amp; Exchanges Report:</span>
                  <span className="text-primary">{supplier?.name}</span>
                </DialogTitle>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-ink/55">
                  <span>Phone: {supplier?.phone || '-'}</span>
                  <span>City: {supplier?.city || '-'}</span>
                  <span className={`font-semibold ${currentBalance > 0 ? 'text-warning-text' : 'text-ink/55'}`}>
                    Outstanding Balance: ${currentBalance.toFixed(2)}
                  </span>
                </div>
              </div>
              {/* Filter toggle — sits left of the Radix × button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-2 shrink-0 mt-1 ${showFilters ? 'border-primary text-primary bg-primary/5' : ''}`}
              >
                <Filter size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          </DialogHeader>

          {/* ── Filter Panel ── */}
          {showFilters && (
            <div className="py-3 px-1 border-b border-ink/[0.06] bg-[#faf9f5]/70 flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Payment Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-sm border border-ink/[0.15] bg-white rounded-[7px] px-3 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-ink/50">From Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm border border-ink/[0.15] bg-white rounded-[7px] px-3 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-ink/50">To Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm border border-ink/[0.15] bg-white rounded-[7px] px-3 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-ink/55 hover:text-danger-text flex items-center gap-1.5">
                  <X size={13} /> Clear All
                </Button>
              )}
            </div>
          )}

          {/* ── Purchases List ── */}
          <div className="flex-1 overflow-y-auto px-1 pb-4 space-y-6">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredPurchases.length === 0 ? (
              <div className="text-center py-20 text-ink/45">
                {purchases.length === 0 ? 'No purchases recorded for this supplier.' : 'No transactions match your filters.'}
              </div>
            ) : (
              sortedDates.map((dateStr) => {
                const purchasesForDate = groupedPurchases[dateStr];
                return (
                  <div key={dateStr} className="space-y-3">
                    {/* Date Section Header */}
                    <div className="flex items-center gap-2 sticky top-0 bg-[#fffdfa] z-10 py-2 border-b border-ink/[0.06]">
                      <span className="text-[12px] font-bold text-primary bg-primary/5 border border-primary/10 rounded-md px-2.5 py-0.5 shadow-sm">
                        {dateStr}
                      </span>
                      <div className="h-px flex-1 bg-ink/[0.04]" />
                      <span className="text-xs text-ink/40 font-medium">
                        {purchasesForDate.length} transaction{purchasesForDate.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Full-width vertical stack list */}
                    <div className="space-y-4">
                      {purchasesForDate.map((purchase) => {
                        const isExpanded = !!expandedPurchases[purchase.id];
                        const returns = returnsMap[purchase.id] || [];
                        const totalRefundedCount = returns
                          .filter(r => r.reference === 'Purchase Refund' || r.reference === 'Purchase Return' || r.type === 'refund')
                          .reduce((sum, r) => sum + Math.abs(r.quantityChange), 0);
                        // Fix #3: only count exchange_out rows (not the exchange_in replacement)
                        const totalExchangedCount = returns
                          .filter(r => r.reference === 'Purchase Exchange' && r.type === 'exchange_out')
                          .reduce((sum, r) => sum + Math.abs(r.quantityChange), 0);
                        const totalActivityCount = totalRefundedCount + totalExchangedCount;
                        const hasOutstandingBalance = Number(purchase.balanceAmount || 0) > 0;

                        return (
                          <Card key={purchase.id} className="border border-ink/[0.08] shadow-sm overflow-hidden hover:border-ink/[0.15] transition-all flex flex-col justify-between">
                            {/* Purchase Header (collapsed view) */}
                            <div
                              onClick={() => toggleExpand(purchase.id)}
                              className="p-4 flex items-center justify-between cursor-pointer bg-[#faf9f5]/50 hover:bg-[#faf9f5] transition-colors"
                            >
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                <div>
                                  <div className="text-xs uppercase tracking-wider font-semibold text-ink/45">Purchase #</div>
                                  <div className="font-semibold text-ink text-[14.5px] mt-0.5">{purchase.purchaseNumber}</div>
                                </div>
                                <div>
                                  <div className="text-xs uppercase tracking-wider font-semibold text-ink/45">Total</div>
                                  <div className="font-bold text-ink text-[14.5px] mt-0.5">${Number(purchase.totalAmount).toFixed(2)}</div>
                                </div>
                                {hasOutstandingBalance && (
                                  <div>
                                    <div className="text-xs uppercase tracking-wider font-semibold text-warning-text">Balance Due</div>
                                    <div className="font-bold text-warning-text text-[14.5px] mt-0.5">${Number(purchase.balanceAmount).toFixed(2)}</div>
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs uppercase tracking-wider font-semibold text-ink/45">Status</div>
                                  <div className="mt-0.5">
                                    <Badge variant={purchase.paymentStatus === 'paid' ? 'success' : purchase.paymentStatus === 'partial' ? 'warning' : 'danger'} className="capitalize">
                                      {purchase.paymentStatus}
                                    </Badge>
                                  </div>
                                </div>
                                {totalActivityCount > 0 && (
                                  <div>
                                    <div className="text-xs uppercase tracking-wider font-semibold text-danger-text">Activity</div>
                                    <div className="mt-0.5 flex gap-1">
                                      {totalRefundedCount > 0 && (
                                        <Badge variant="danger" className="flex items-center gap-1 font-bold">
                                          Refunded: {totalRefundedCount}
                                        </Badge>
                                      )}
                                      {totalExchangedCount > 0 && (
                                        <Badge variant="warning" className="flex items-center gap-1 font-bold">
                                          Exchanged: {totalExchangedCount}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                {hasOutstandingBalance && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => { e.stopPropagation(); handleOpenPayDialog(purchase); }}
                                    className="h-7 text-xs border-success/30 text-success-text hover:bg-success/10 flex items-center gap-1"
                                  >
                                    <DollarSign size={12} /> Pay Balance
                                  </Button>
                                )}
                                {isExpanded ? <ChevronUp size={20} className="text-ink/45" /> : <ChevronDown size={20} className="text-ink/45" />}
                              </div>
                            </div>

                            {/* Expanded Detail */}
                            {isExpanded && (
                              <CardContent className="p-4 border-t border-ink/[0.06] bg-white space-y-4 flex-1">
                                {/* Items Table */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink/65 flex items-center gap-1">
                                      <Package size={13} /> Purchased Items
                                    </h4>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => { e.stopPropagation(); handleOpenRefundExchangeDialog(purchase); }}
                                      className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1"
                                    >
                                      Refund / Exchange
                                    </Button>
                                  </div>
                                  <div className="overflow-x-auto border border-ink/[0.06] rounded-md">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-ink/[0.06] bg-slate-50">
                                          <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Product</th>
                                          <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">SKU</th>
                                          <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Qty</th>
                                          <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Refunded</th>
                                          <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Exchanged</th>
                                          <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Unit Price</th>
                                          <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {purchase.items?.map((item: any) => {
                                          const variantId    = item.variant_id || item.variantId || '';
                                          const refundedQty  = getRefundedQty(purchase.id, variantId);
                                          const exchangedQty = getExchangedQty(purchase.id, variantId);
                                          // New join: item.variant.product.name (product_variant_flat)
                                          const productName  = item.variant?.product?.name
                                                            ?? item.product?.name
                                                            ?? '—';
                                          const sku          = item.variant?.sku
                                                            ?? item.product?.sku
                                                            ?? '-';
                                          const variantLabel = item.variant?.variant_name && item.variant.variant_name !== 'Default'
                                            ? ` – ${item.variant.variant_name}` : '';
                                          return (
                                            <tr key={item.id} className="border-b border-ink/[0.04] hover:bg-[#faf9f5]/30">
                                              <td className="py-2.5 px-3 font-semibold text-ink">
                                                {productName}{variantLabel}
                                              </td>
                                              <td className="py-2.5 px-3 text-center text-ink/55">{sku}</td>
                                              <td className="py-2.5 px-3 text-right font-semibold text-ink">{item.quantity}</td>
                                              <td className={`py-2.5 px-3 text-right font-bold ${refundedQty > 0 ? 'text-danger-text' : 'text-ink/35'}`}>
                                                {refundedQty > 0 ? refundedQty : '-'}
                                              </td>
                                              <td className={`py-2.5 px-3 text-right font-bold ${exchangedQty > 0 ? 'text-warning-text' : 'text-ink/35'}`}>
                                                {exchangedQty > 0 ? exchangedQty : '-'}
                                              </td>
                                              <td className="py-2.5 px-3 text-right text-ink/65">${Number(item.unitPrice).toFixed(2)}</td>
                                              <td className="py-2.5 px-3 text-right font-bold text-ink">${Number(item.totalAmount).toFixed(2)}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Returns History */}
                                {returns.length > 0 && (
                                  <div className="pt-2 border-t border-dashed border-ink/[0.08]">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-danger-text mb-2 flex items-center gap-1">
                                      <AlertCircle size={13} /> Refunds &amp; Exchanges History
                                    </h4>
                                    <div className="overflow-x-auto border border-danger/15 rounded-md">
                                      <table className="w-full text-sm bg-danger/[0.01]">
                                        <thead>
                                          <tr className="border-b border-danger/15 bg-danger/[0.03]">
                                            <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Product</th>
                                            <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Type</th>
                                            <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Qty</th>
                                            <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Date</th>
                                            <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Notes</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {returns.map((ret: any) => (
                                            <tr key={ret.id} className="border-b border-danger/10 hover:bg-danger/[0.04]">
                                              <td className="py-2 px-3 font-medium text-ink">
                                                {ret.variant?.product?.name ?? ret.product?.name ?? 'Product'}
                                                {ret.variant?.variant_name && ret.variant.variant_name !== 'Default'
                                                  ? ` – ${ret.variant.variant_name}` : ''}
                                              </td>
                                              <td className="py-2 px-3 text-left">
                                                <Badge variant={ret.reference === 'Purchase Exchange' ? 'warning' : 'danger'} className="capitalize text-[10px]">
                                                  {ret.reference === 'Purchase Exchange' ? (ret.type === 'exchange_out' ? 'exchange out' : 'exchange in') : 'refund'}
                                                </Badge>
                                              </td>
                                              <td className="py-2 px-3 text-right font-bold text-ink">{Math.abs(ret.quantityChange)}</td>
                                              <td className="py-2 px-3 text-ink/75">{formatDate(ret.createdAt)}</td>
                                              <td className="py-2 px-3 text-ink/65 italic">{ret.notes}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-ink/[0.08] flex justify-end">
            <Button variant="outline" onClick={onClose}>Close Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Refund / Exchange Dialog ── */}
      <Dialog open={refundExchangeDialogOpen} onOpenChange={(v) => { if (!v) setRefundExchangeDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-ink">Refund or Exchange Items</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitRefundExchange} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ref-product">Select Variant</Label>
              <select
                id="ref-product"
                value={selectedVariantId}
                onChange={(e) => {
                  setSelectedVariantId(e.target.value);
                  setRefundExchangeQty(1);
                }}
                className="w-full text-sm border border-ink/[0.15] bg-white rounded-[7px] px-3 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {activePurchaseItems.map((item) => {
                  const vid   = item.variant_id || item.variantId || item.productId;
                  const pName = item.variant?.product?.name ?? item.product?.name ?? '—';
                  const vName = item.variant?.variant_name && item.variant.variant_name !== 'Default'
                    ? ` – ${item.variant.variant_name}` : '';
                  const sku   = item.variant?.sku ?? item.product?.sku ?? '';
                  return (
                    <option key={vid} value={vid}>
                      {pName}{vName}{sku ? ` (${sku})` : ''}
                    </option>
                  );
                })}
              </select>
              <div className="text-xs text-ink/45 mt-1">
                Max returnable: <span className="font-bold text-ink">{activeProductIdMaxQty}</span> unit(s)
              </div>
              {activeProductIdMaxQty <= 0 && (                <div className="text-xs font-semibold text-danger mt-1">
                  This product has already been fully refunded or exchanged.
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-action">Action Type</Label>
              <select
                id="ref-action"
                value={actionType}
                onChange={(e) => setActionType(e.target.value as 'refund' | 'exchange')}
                className="w-full text-sm border border-ink/[0.15] bg-white rounded-[7px] px-3 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="refund">Refund (Return to Supplier & Cash/Credit Back)</option>
                <option value="exchange">Exchange (Swap/Replace Item)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-qty">Quantity</Label>
              <Input
                id="ref-qty"
                type="number"
                min={1}
                max={activeProductIdMaxQty}
                value={refundExchangeQty}
                onChange={(e) => setRefundExchangeQty(Math.min(activeProductIdMaxQty || 1, Math.max(1, parseInt(e.target.value) || 1)))}                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-notes">Notes / Reason</Label>
              <Input
                id="ref-notes"
                placeholder={`e.g. Reason for ${actionType}...`}
                value={refundExchangeNotes}
                onChange={(e) => setRefundExchangeNotes(e.target.value)}
              />
            </div>

            {/* Plain flex row — not DialogFooter, avoids flex-col-reverse in Electron */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRefundExchangeDialogOpen(false)}
                disabled={isSubmittingRefundExchange}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingRefundExchange || activeProductIdMaxQty <= 0}
                className="bg-danger hover:bg-danger/85 text-black"
              >
                {isSubmittingRefundExchange ? 'Processing...' : `Confirm ${actionType === 'refund' ? 'Refund' : 'Exchange'}`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Record Balance Payment Dialog ── */}
      <Dialog open={payDialogOpen} onOpenChange={(v) => { if (!v) setPayDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-ink">Record Supplier Payment</DialogTitle>
          </DialogHeader>

          <form id="pay-form" onSubmit={handleSubmitPayment} className="space-y-4">
            <div className="bg-ink/[0.03] border border-ink/[0.06] rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-ink/55">Purchase:</span>
                <span className="font-semibold text-ink">{payForPurchase?.purchaseNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink/55">Purchase Balance Due:</span>
                <span className="font-bold text-warning-text">${Number(payForPurchase?.balanceAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-ink/[0.06] pt-1.5 mt-1">
                <span className="text-ink/55">Supplier Outstanding Balance:</span>
                <span className="font-bold text-ink">${currentBalance.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Payment Amount</Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min={0.01}
                max={Number(payForPurchase?.balanceAmount || 0)}
                value={payAmount}
                onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                required
              />
              <p className="text-xs text-ink/40">Amount will be deducted from the purchase balance and supplier outstanding balance.</p>
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayDialogOpen(false)} disabled={isSubmittingPayment}>
              Cancel
            </Button>
            <Button form="pay-form" type="submit" disabled={isSubmittingPayment || payAmount <= 0 || payAmount > Number(payForPurchase?.balanceAmount || 0)}>
              {isSubmittingPayment ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
