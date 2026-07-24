import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Trash2, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';

interface ReturnItemSelection {
  saleItemId: string;
  variantId: string;
  productFlatId: string;
  productName: string;
  variantLabel: string;
  unitPrice: number;
  maxQty: number;
  returnQty: number;
  condition: 'resellable' | 'damaged';
  reason: string;
  selected: boolean;
}

interface ExchangeItemSelection {
  variantId: string;
  productFlatId: string;
  name: string;
  unitPrice: number;
  qty: number;
}

interface SaleReturnModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sale: any;
}

export const SaleReturnModal: React.FC<SaleReturnModalProps> = ({
  open,
  onClose,
  onSuccess,
  sale,
}) => {
  const { formatCurrency } = useSettings();
  const [loading, setLoading] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItemSelection[]>([]);
  const [exchangeItems, setExchangeItems] = useState<ExchangeItemSelection[]>([]);
  
  // Exchange product picker search state
  const [searchVariantQuery, setSearchVariantQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Settlement state
  const [settlementType, setSettlementType] = useState<'cash' | 'card' | 'store_credit'>('cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !sale) return;

    // Load existing returns for this sale to compute remaining max qty
    const fetchReturns = window.electron?.getSaleReturnsBatch 
      ? window.electron.getSaleReturnsBatch([sale.id]) 
      : Promise.resolve({ success: true, data: {} });

    fetchReturns.then((res: any) => {
      const existingHistory = (res?.success && res?.data && res.data[sale.id]) || [];

      const items: ReturnItemSelection[] = (sale.items || []).map((i: any) => {
        const vId = i.variantId || i.variant_id;
        const pId = i.productId || i.product_id;
        
        // Sum past returns for this variant
        const alreadyReturned = existingHistory
          .filter((h: any) => (h.variantId || h.variant_id) === vId && (h.type === 'sale_return' || h.type === 'sale_return_damaged'))
          .reduce((sum: number, h: any) => sum + Math.abs(h.quantityChange || 0), 0);

        const maxQty = Math.max(0, (i.quantity || 1) - alreadyReturned);

        const vName = i.variant?.variantName || i.variant?.variant_name;
        const color = i.variant?.color;
        const size  = i.variant?.size;
        const label = [vName !== 'Default' ? vName : null, color, size].filter(Boolean).join(' · ') || 'Default';

        return {
          saleItemId: i.id,
          variantId: vId,
          productFlatId: pId,
          productName: i.product?.name || i.variant?.product?.name || 'Product',
          variantLabel: label,
          unitPrice: Number(i.unitPrice || 0),
          maxQty,
          returnQty: maxQty > 0 ? 1 : 0,
          condition: 'resellable',
          reason: 'Customer Return',
          selected: false,
        };
      });

      setReturnItems(items);
      setExchangeItems([]);
      setSettlementType('cash');
      setNotes('');
    });
  }, [open, sale]);

  // Variant search for exchange
  const handleSearchVariants = async (query: string) => {
    setSearchVariantQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await window.electron.searchVariants(query, 10);
      if (res.success) {
        setSearchResults(res.data || []);
      }
    } catch {}
    finally {
      setIsSearching(false);
    }
  };

  const addExchangeVariant = (variant: any) => {
    const vId = variant.id;
    const pId = variant.productFlatId || variant.product_flat_id;
    const name = `${variant.parent?.name || variant.productName || 'Product'} (${[variant.variantName !== 'Default' ? variant.variantName : null, variant.color, variant.size].filter(Boolean).join(' · ') || 'Default'})`;
    const price = Number(variant.parent?.selling_price || variant.sellingPrice || 0);

    const existing = exchangeItems.find((e) => e.variantId === vId);
    if (existing) {
      setExchangeItems(
        exchangeItems.map((e) => (e.variantId === vId ? { ...e, qty: e.qty + 1 } : e))
      );
    } else {
      setExchangeItems([...exchangeItems, { variantId: vId, productFlatId: pId, name, unitPrice: price, qty: 1 }]);
    }
    setSearchVariantQuery('');
    setSearchResults([]);
  };

  const removeExchangeItem = (index: number) => {
    setExchangeItems(exchangeItems.filter((_, i) => i !== index));
  };

  const updateReturnItem = (index: number, updates: Partial<ReturnItemSelection>) => {
    setReturnItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  // Computations
  const activeReturns = returnItems.filter((r) => r.selected && r.returnQty > 0);
  const totalReturnedValue = activeReturns.reduce((sum, r) => sum + r.returnQty * r.unitPrice, 0);
  const totalExchangedValue = exchangeItems.reduce((sum, e) => sum + e.qty * e.unitPrice, 0);

  const netDifference = totalReturnedValue - totalExchangedValue; // > 0 means refund to customer, < 0 means customer pays extra
  const refundAmount = Math.max(0, netDifference);
  const additionalAmountPaid = Math.max(0, -netDifference);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeReturns.length === 0 && exchangeItems.length === 0) {
      toast.error('Please select at least one item to return or exchange.');
      return;
    }

    for (const r of activeReturns) {
      if (r.returnQty > r.maxQty) {
        toast.error(`Return quantity for ${r.productName} exceeds remaining available (${r.maxQty}).`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await window.electron.processSaleReturnOrExchange({
        saleId: sale.id,
        customerId: sale.customerId || sale.customer?.id,
        returnItems: activeReturns.map((r) => ({
          saleItemId: r.saleItemId,
          variantId: r.variantId,
          productFlatId: r.productFlatId,
          quantity: r.returnQty,
          condition: r.condition,
          reason: r.reason,
        })),
        exchangeItems: exchangeItems.map((e) => ({
          variantId: e.variantId,
          productFlatId: e.productFlatId,
          quantity: e.qty,
          unitPrice: e.unitPrice,
        })),
        settlementType,
        refundAmount,
        additionalAmountPaid,
        notes,
      });

      if (res.success) {
        toast.success('Return / Exchange processed successfully!');
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || 'Failed to process return / exchange.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'An error occurred processing return / exchange.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Customer Return / Exchange — Invoice #{sale?.saleNumber}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Customer Info Header */}
          <div className="flex items-center justify-between bg-[#faf9f5] border p-3 rounded-lg text-sm">
            <div>
              <span className="text-ink/55">Customer: </span>
              <span className="font-semibold text-ink">{sale?.customer?.name || 'Walk-in Customer'}</span>
              {sale?.customer?.phone && <span className="ml-2 text-ink/40">({sale.customer.phone})</span>}
            </div>
            <div>
              <span className="text-ink/55">Date: </span>
              <span className="text-ink font-medium">{new Date(sale?.saleDate || sale?.createdAt || Date.now()).toLocaleDateString()}</span>
            </div>
          </div>

          {/* 1. SELECT ITEMS TO RETURN */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-ink uppercase tracking-wider text-xs text-ink/60">
              1. Select Items to Return
            </h3>
            {returnItems.length === 0 ? (
              <p className="text-xs text-ink/40 italic py-2">No items found in this sale.</p>
            ) : (
              <div className="space-y-2">
                {returnItems.map((item, idx) => (
                  <div
                    key={item.saleItemId}
                    className={`border rounded-lg p-3 transition-colors ${
                      item.selected ? 'bg-primary/5 border-primary/30' : 'bg-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`ret-${idx}`}
                        disabled={item.maxQty <= 0}
                        checked={item.selected}
                        onChange={(e) => updateReturnItem(idx, { selected: e.target.checked })}
                        className="h-4 w-4 rounded accent-primary cursor-pointer"
                      />
                      <label htmlFor={`ret-${idx}`} className="flex-1 text-sm cursor-pointer">
                        <span className="font-semibold text-ink">{item.productName}</span>
                        <span className="ml-2 text-xs text-ink/50">({item.variantLabel})</span>
                        <span className="ml-2 font-bold text-xs text-primary">{formatCurrency(item.unitPrice)}</span>
                      </label>
                      <Badge variant={item.maxQty > 0 ? 'secondary' : 'warning'}>
                        {item.maxQty > 0 ? `Max Return: ${item.maxQty}` : 'Already Fully Returned'}
                      </Badge>
                    </div>

                    {item.selected && item.maxQty > 0 && (
                      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-ink/[0.06]">
                        <div>
                          <Label className="text-xs">Return Quantity</Label>
                          <Input
                            type="number"
                            min={1}
                            max={item.maxQty}
                            value={item.returnQty}
                            onChange={(e) =>
                              updateReturnItem(idx, {
                                returnQty: Math.min(item.maxQty, Math.max(1, parseInt(e.target.value) || 1)),
                              })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Condition</Label>
                          <Select
                            value={item.condition}
                            onValueChange={(val: 'resellable' | 'damaged') => updateReturnItem(idx, { condition: val })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="resellable">Resellable (Restores Stock)</SelectItem>
                              <SelectItem value="damaged">Damaged / Defective (No Stock)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Reason</Label>
                          <Input
                            type="text"
                            placeholder="e.g. Wrong size, Defective"
                            value={item.reason}
                            onChange={(e) => updateReturnItem(idx, { reason: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. OPTIONAL EXCHANGE REPLACEMENT ITEMS */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-ink uppercase tracking-wider text-xs text-ink/60">
                2. Exchange Replacement Items (Optional)
              </h3>
            </div>

            <div className="relative">
              {isSearching ? (
                <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 animate-spin" size={16} />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={16} />
              )}
              <Input
                placeholder="Search replacement variant to add for exchange..."
                value={searchVariantQuery}
                onChange={(e) => handleSearchVariants(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => addExchangeVariant(v)}
                      className="px-3 py-2 text-xs hover:bg-primary/10 cursor-pointer flex justify-between items-center border-b last:border-0"
                    >
                      <div>
                        <span className="font-semibold text-ink">
                          {v.parent?.name || v.productName} ({[v.variantName !== 'Default' ? v.variantName : null, v.color, v.size].filter(Boolean).join(' · ') || 'Default'})
                        </span>
                        {v.sku && <span className="ml-2 font-mono text-ink/40">{v.sku}</span>}
                      </div>
                      <span className="font-bold text-primary">
                        {formatCurrency(v.parent?.selling_price || v.sellingPrice || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {exchangeItems.length > 0 && (
              <div className="border rounded-lg p-3 bg-[#faf9f5] space-y-2 text-xs">
                {exchangeItems.map((ex, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 bg-white p-2 rounded border">
                    <span className="font-medium text-ink flex-1">{ex.name}</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Qty:</Label>
                      <Input
                        type="number"
                        min={1}
                        value={ex.qty}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setExchangeItems(exchangeItems.map((item, idx) => (idx === i ? { ...item, qty: val } : item)));
                        }}
                        className="h-7 w-16 text-center text-xs"
                      />
                    </div>
                    <span className="font-bold text-ink w-20 text-right">{formatCurrency(ex.qty * ex.unitPrice)}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-danger-text"
                      onClick={() => removeExchangeItem(i)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. SETTLEMENT & SUMMARY */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-sm text-ink uppercase tracking-wider text-xs text-ink/60">
              3. Financial Settlement
            </h3>

            <div className="grid grid-cols-2 gap-4 bg-[#faf9f5] p-4 rounded-lg text-sm border">
              <div className="space-y-1.5 border-r pr-4">
                <div className="flex justify-between">
                  <span className="text-ink/60">Total Returned Items:</span>
                  <span className="font-semibold">{formatCurrency(totalReturnedValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink/60">Total Exchanged Items:</span>
                  <span className="font-semibold">{formatCurrency(totalExchangedValue)}</span>
                </div>
              </div>

              <div className="space-y-1.5 flex flex-col justify-center">
                {netDifference >= 0 ? (
                  <div className="flex justify-between text-base">
                    <span className="font-bold text-ink">Refund Amount Due:</span>
                    <span className="font-bold text-primary">{formatCurrency(refundAmount)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-base">
                    <span className="font-bold text-ink">Customer Pays Difference:</span>
                    <span className="font-bold text-danger-text">{formatCurrency(additionalAmountPaid)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Settlement Method</Label>
                <Select
                  value={settlementType}
                  onValueChange={(val: 'cash' | 'card' | 'store_credit') => setSettlementType(val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash Refund / Payment</SelectItem>
                    <SelectItem value="card">Card / Online (QR)</SelectItem>
                    <SelectItem value="store_credit" disabled={!sale?.customerId && !sale?.customer?.id}>
                      Store Credit {!sale?.customerId && !sale?.customer?.id ? '(Customer required)' : ''}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Notes / Reference</Label>
                <Input
                  type="text"
                  placeholder="Optional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || (activeReturns.length === 0 && exchangeItems.length === 0)}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Return / Exchange
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
