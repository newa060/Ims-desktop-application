import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { ChevronDown, ChevronUp, AlertCircle, RotateCcw, Calendar, Package } from 'lucide-react';
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
  
  // Return Form State
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<{ purchaseId: string; productId: string; maxQty: number; productName: string } | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnNotes, setReturnNotes] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const loadReportData = useCallback(async () => {
    if (!supplier?.id) return;
    setLoading(true);
    try {
      // Fetch all purchases for this supplier (no limit or high limit for full report)
      const res = await window.electron.getPurchases({ supplierId: supplier.id, limit: 100 });
      if (res.success) {
        setPurchases(res.data.data);
        
        // Fetch returns for each purchase
        const pReturns: Record<string, any[]> = {};
        for (const p of res.data.data) {
          const retRes = await window.electron.getPurchaseReturns(p.id);
          if (retRes.success) {
            pReturns[p.id] = retRes.data;
          }
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
    setExpandedPurchases((prev) => ({
      ...prev,
      [purchaseId]: !prev[purchaseId],
    }));
  };

  const getReturnedQty = (purchaseId: string, productId: string) => {
    const returns = returnsMap[purchaseId] || [];
    return returns
      .filter((r) => r.productId === productId)
      .reduce((sum, r) => sum + Math.abs(r.quantityChange), 0);
  };

  const handleOpenReturnDialog = (purchaseId: string, item: any) => {
    const alreadyReturned = getReturnedQty(purchaseId, item.productId);
    const maxQty = item.quantity - alreadyReturned;

    if (maxQty <= 0) {
      toast.error('All units of this item have already been returned.');
      return;
    }

    setActiveItem({
      purchaseId,
      productId: item.productId,
      maxQty,
      productName: item.product?.name || 'Unknown Product',
    });
    setReturnQty(1);
    setReturnNotes('');
    setReturnDialogOpen(true);
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    if (returnQty <= 0 || returnQty > activeItem.maxQty) {
      toast.error(`Invalid quantity. Maximum returnable is ${activeItem.maxQty}.`);
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const res = await window.electron.createPurchaseReturn({
        purchaseId: activeItem.purchaseId,
        productId: activeItem.productId,
        quantity: returnQty,
        notes: returnNotes,
      });

      if (res.success) {
        toast.success('Return logged successfully');
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

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-4 border-b border-ink/[0.08]">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <span>Supplier Transaction & Returns Report:</span>
              <span className="text-primary font-semibold">{supplier?.name}</span>
            </DialogTitle>
            <div className="flex gap-4 mt-2 text-sm text-ink/55">
              <span>Phone: {supplier?.phone || '-'}</span>
              <span>City: {supplier?.city || '-'}</span>
              <span>Balance: ${Number(supplier?.balance || 0).toFixed(2)}</span>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : purchases.length === 0 ? (
              <div className="text-center py-20 text-ink/45">No purchases recorded for this supplier.</div>
            ) : (
              purchases.map((purchase) => {
                const isExpanded = !!expandedPurchases[purchase.id];
                const returns = returnsMap[purchase.id] || [];
                const totalReturnedCount = returns.reduce((sum, r) => sum + Math.abs(r.quantityChange), 0);

                return (
                  <Card key={purchase.id} className="border border-ink/[0.08] shadow-sm overflow-hidden hover:border-ink/[0.15] transition-all">
                    {/* Collapsed Header */}
                    <div 
                      onClick={() => toggleExpand(purchase.id)}
                      className="p-4 flex items-center justify-between cursor-pointer bg-[#faf9f5]/50 hover:bg-[#faf9f5] transition-colors"
                    >
                      <div className="flex items-center gap-6">
                        <div>
                          <div className="text-xs uppercase tracking-wider font-semibold text-ink/45">Purchase Number</div>
                          <div className="font-semibold text-ink text-[14.5px] mt-0.5">{purchase.purchaseNumber}</div>
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-xs uppercase tracking-wider font-semibold text-ink/45">Date</div>
                          <div className="text-ink/75 text-[14.5px] mt-0.5 flex items-center gap-1.5">
                            <Calendar size={14} className="text-ink/35" />
                            {formatDate(purchase.purchaseDate)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider font-semibold text-ink/45">Total Amount</div>
                          <div className="font-bold text-ink text-[14.5px] mt-0.5">${Number(purchase.totalAmount).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider font-semibold text-ink/45">Status</div>
                          <div className="mt-0.5">
                            <Badge variant={purchase.paymentStatus === 'paid' ? 'success' : 'warning'} className="capitalize">
                              {purchase.paymentStatus}
                            </Badge>
                          </div>
                        </div>
                        {totalReturnedCount > 0 && (
                          <div>
                            <div className="text-xs uppercase tracking-wider font-semibold text-danger-text">Returned Goods</div>
                            <div className="mt-0.5">
                              <Badge variant="danger" className="flex items-center gap-1 font-bold">
                                <AlertCircle size={10} />
                                {totalReturnedCount} Units
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        {isExpanded ? <ChevronUp size={20} className="text-ink/45" /> : <ChevronDown size={20} className="text-ink/45" />}
                      </div>
                    </div>

                    {/* Expanded Detail View */}
                    {isExpanded && (
                      <CardContent className="p-4 border-t border-ink/[0.06] bg-white space-y-4">
                        {/* Purchased Items List */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-ink/65 mb-2 flex items-center gap-1">
                            <Package size={14} /> Purchased Items
                          </h4>
                          <div className="overflow-x-auto border border-ink/[0.06] rounded-md">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-ink/[0.06] bg-slate-50">
                                  <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Product</th>
                                  <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">SKU</th>
                                  <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Purchased Qty</th>
                                  <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-ink/45">Returned Qty</th>
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
                                      <td className={`py-2.5 px-3 text-right font-bold ${returnedQty > 0 ? 'text-danger-text' : 'text-ink/45'}`}>
                                        {returnedQty}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-ink/65">${Number(item.unitPrice).toFixed(2)}</td>
                                      <td className="py-2.5 px-3 text-right font-bold text-ink">${Number(item.totalAmount).toFixed(2)}</td>
                                      <td className="py-2.5 px-3 text-center">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={isReturnedAll}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenReturnDialog(purchase.id, item);
                                          }}
                                          className={`h-7 text-xs border-danger/30 text-danger-text hover:bg-danger/10 ${isReturnedAll ? 'opacity-55' : ''}`}
                                        >
                                          <RotateCcw size={12} className="mr-1" /> Return Damaged
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Returned Goods List */}
                        {returns.length > 0 && (
                          <div className="pt-2 border-t border-dashed border-ink/[0.08]">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-danger-text mb-2 flex items-center gap-1">
                              <AlertCircle size={14} /> Damaged Returns History
                            </h4>
                            <div className="overflow-x-auto border border-danger/15 rounded-md">
                              <table className="w-full text-sm bg-danger/[0.01]">
                                <thead>
                                  <tr className="border-b border-danger/15 bg-danger/[0.03]">
                                    <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Product</th>
                                    <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Returned Qty</th>
                                    <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Return Date</th>
                                    <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-danger-text">Reason/Notes</th>
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

      {/* Log Damage/Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-ink">Return Damaged Goods</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitReturn} className="space-y-4 pt-2">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-ink/45">Product</div>
              <div className="font-semibold text-ink text-[14.5px] mt-0.5">{activeItem?.productName}</div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantity to Return (Max {activeItem?.maxQty})</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                max={activeItem?.maxQty}
                value={returnQty}
                onChange={(e) => setReturnQty(Math.min(activeItem?.maxQty || 1, Math.max(1, parseInt(e.target.value) || 1)))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes / Damage Description</Label>
              <Input
                id="notes"
                placeholder="e.g. Scratched screen, broken seal..."
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setReturnDialogOpen(false)} disabled={isSubmittingReturn}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingReturn} className="bg-danger hover:bg-danger/90 text-white">
                {isSubmittingReturn ? 'Processing...' : 'Confirm Return'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
