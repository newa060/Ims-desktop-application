import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { ChevronDown, ChevronUp, AlertCircle, RotateCcw, Calendar, Package, Filter, X, DollarSign } from 'lucide-react';
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

  // Return Damaged Goods State
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const loadReportData = useCallback(async () => {
    if (!supplier?.id) return;
    setLoading(true);
    setCurrentBalance(Number(supplier?.balance || 0));
    try {
      const res = await window.electron.getPurchases({ supplierId: supplier.id, limit: 100 });
      if (res.success) {
        setPurchases(res.data.data);
        const pReturns: Record<string, any[]> = {};
        for (const p of res.data.data) {
          const retRes = await window.electron.getPurchaseReturns(p.id);
          if (retRes.success) pReturns[p.id] = retRes.data;
        }
        setReturnsMap(pReturns);
      } else {
        toast.error('Failed to load supplier report');
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

  const getReturnedQty = (purchaseId: string, productId: string) => {
    const returns = returnsMap[purchaseId] || [];
    return returns.filter((r) => r.productId === productId).reduce((sum, r) => sum + Math.abs(r.quantityChange), 0);
  };

  // --- Return (Damaged Goods) ---
  const handleOpenReturnDialog = (purchaseId: string, item: any) => {
    const alreadyReturned = getReturnedQty(purchaseId, item.productId);
    const maxQty = item.quantity - alreadyReturned;
    if (maxQty <= 0) { toast.error('All units have already been returned.'); return; }
    setActiveItem({ purchaseId, productId: item.productId, maxQty, productName: item.product?.name || 'Unknown Product' });
    setReturnQty(1);
    setReturnNotes('');
    setReturnDialogOpen(true);
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    if (returnQty <= 0 || returnQty > activeItem.maxQty) {
      toast.error(`Quantity must be between 1 and ${activeItem.maxQty}.`);
      return;
    }
    setIsSubmittingReturn(true);
    try {
      const res = await window.electron.createPurchaseReturn({
        purchaseId: activeItem.purchaseId,
        productId: activeItem.productId,
        quantity: returnQty,
        notes: returnNotes || 'Damaged goods returned to supplier',
      });
      if (res.success) {
        toast.success('Return logged & stock updated successfully');
        setReturnDialogOpen(false);
        loadReportData();
      } else {
        toast.error(res.error || 'Failed to log return');
      }
    } catch {
      toast.error('An error occurred processing the return');
    } finally {
      setIsSubmittingReturn(false);
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
                  <span>Transaction &amp; Returns Report:</span>
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
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredPurchases.length === 0 ? (
              <div className="text-center py-20 text-ink/45">
                {purchases.length === 0 ? 'No purchases recorded for this supplier.' : 'No transactions match your filters.'}
              </div>
            ) : (
              filteredPurchases.map((purchase) => {
                const isExpanded = !!expandedPurchases[purchase.id];
                const returns = returnsMap[purchase.id] || [];
                const totalReturnedCount = returns.reduce((sum, r) => sum + Math.abs(r.quantityChange), 0);
                const hasOutstandingBalance = Number(purchase.balanceAmount || 0) > 0;

                return (
                  <Card key={purchase.id} className="border border-ink/[0.08] shadow-sm overflow-hidden hover:border-ink/[0.15] transition-all">
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
                        <div className="hidden sm:block">
                          <div className="text-xs uppercase tracking-wider font-semibold text-ink/45">Date</div>
                          <div className="text-ink/75 text-[14.5px] mt-0.5 flex items-center gap-1.5">
                            <Calendar size={13} className="text-ink/35" />
                            {formatDate(purchase.purchaseDate)}
                          </div>
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
                        {totalReturnedCount > 0 && (
                          <div>
                            <div className="text-xs uppercase tracking-wider font-semibold text-danger-text">Returns</div>
                            <div className="mt-0.5">
                              <Badge variant="danger" className="flex items-center gap-1 font-bold">
                                <AlertCircle size={10} /> {totalReturnedCount} units
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {/* Record Payment button — only when balance is owed */}
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
                      <CardContent className="p-4 border-t border-ink/[0.06] bg-white space-y-4">
                        {/* Items Table */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-ink/65 mb-2 flex items-center gap-1">
                            <Package size={13} /> Purchased Items
                          </h4>
                          <div className="overflow-x-auto border border-ink/[0.06] rounded-md">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-ink/[0.06] bg-slate-50">
                                  <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Product</th>
                                  <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">SKU</th>
                                  <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Qty</th>
                                  <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Returned</th>
                                  <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Unit Price</th>
                                  <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Total</th>
                                  <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {purchase.items?.map((item: any) => {
                                  const returnedQty = getReturnedQty(purchase.id, item.productId);
                                  const isReturnedAll = returnedQty >= item.quantity;
                                  return (
                                    <tr key={item.id} className="border-b border-ink/[0.04] hover:bg-[#faf9f5]/30">
                                      <td className="py-2.5 px-3 font-semibold text-ink">{item.product?.name}</td>
                                      <td className="py-2.5 px-3 text-center text-ink/55">{item.product?.sku || '-'}</td>
                                      <td className="py-2.5 px-3 text-right font-semibold text-ink">{item.quantity}</td>
                                      <td className={`py-2.5 px-3 text-right font-bold ${returnedQty > 0 ? 'text-danger-text' : 'text-ink/35'}`}>
                                        {returnedQty > 0 ? returnedQty : '-'}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-ink/65">${Number(item.unitPrice).toFixed(2)}</td>
                                      <td className="py-2.5 px-3 text-right font-bold text-ink">${Number(item.totalAmount).toFixed(2)}</td>
                                      <td className="py-2.5 px-3 text-center">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={isReturnedAll}
                                          onClick={(e) => { e.stopPropagation(); handleOpenReturnDialog(purchase.id, item); }}
                                          className={`h-7 text-xs border-danger/30 text-danger-text hover:bg-danger/10 ${isReturnedAll ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        >
                                          <RotateCcw size={11} className="mr-1" />
                                          {isReturnedAll ? 'All Returned' : 'Return Damaged'}
                                        </Button>
                                      </td>
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
                              <AlertCircle size={13} /> Damaged Returns History
                            </h4>
                            <div className="overflow-x-auto border border-danger/15 rounded-md">
                              <table className="w-full text-sm bg-danger/[0.01]">
                                <thead>
                                  <tr className="border-b border-danger/15 bg-danger/[0.03]">
                                    <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Product</th>
                                    <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Qty Returned</th>
                                    <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Date</th>
                                    <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {returns.map((ret: any) => (
                                    <tr key={ret.id} className="border-b border-danger/10 hover:bg-danger/[0.04]">
                                      <td className="py-2 px-3 font-medium text-ink">{ret.product?.name || 'Product'}</td>
                                      <td className="py-2 px-3 text-right font-bold text-danger-text">{Math.abs(ret.quantityChange)}</td>
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
              })
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-ink/[0.08] flex justify-end">
            <Button variant="outline" onClick={onClose}>Close Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Return Damaged Goods Dialog ── */}
      <Dialog open={returnDialogOpen} onOpenChange={(v) => { if (!v) setReturnDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-ink">Return Damaged Goods</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitReturn} className="space-y-4">
            <div className="bg-ink/[0.03] border border-ink/[0.06] rounded-lg p-3">
              <div className="text-[11px] uppercase tracking-wider font-bold text-ink/45">Product</div>
              <div className="font-semibold text-ink text-[15px] mt-0.5">{activeItem?.productName}</div>
              <div className="text-xs text-ink/45 mt-1">Max returnable: <span className="font-bold text-ink">{activeItem?.maxQty}</span> unit(s)</div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ret-qty">Quantity to Return</Label>
              <Input
                id="ret-qty"
                type="number"
                min={1}
                max={activeItem?.maxQty}
                value={returnQty}
                onChange={(e) => setReturnQty(Math.min(activeItem?.maxQty || 1, Math.max(1, parseInt(e.target.value) || 1)))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ret-notes">Damage Description</Label>
              <Input
                id="ret-notes"
                placeholder="e.g. Scratched screen, broken seal..."
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
              />
            </div>

            {/* Plain flex row — not DialogFooter, avoids flex-col-reverse in Electron */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReturnDialogOpen(false)}
                disabled={isSubmittingReturn}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingReturn}
                className="bg-danger hover:bg-danger/85 text-white"
              >
                {isSubmittingReturn ? 'Processing...' : 'Confirm Return'}
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
