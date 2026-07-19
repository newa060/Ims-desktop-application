import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Trash2, Plus, Minus, ShoppingCart, User, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';


interface CartItem {
  productFlatId: string;  // product_variant_flat.id
  variantId: string;      // product_variant.id
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  taxRate: number;
  discountAmount: number;
}

interface InvoiceData {
  saleNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  paymentMethod: string;
  paymentStatus: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    total: number;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  notes?: string;
}

const POSPage = () => {
  const { formatCurrency, settings, currencySymbol } = useSettings();
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>(undefined);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const res = await window.electron.getCustomers({ page: 1, limit: 100 });
      if (res.success) setCustomers(res.data.data);
    } catch (error) {
      console.error('Failed to load customers');
    }
  };

  const tryAddVariant = (variant: any): boolean => {
    if (!variant) return false;
    if ((variant.stock ?? 0) <= 0) {
      toast.error('Variant out of stock!');
      return false;
    }
    addToCart(variant);
    setBarcode('');
    setSearchResults([]);
    toast.success('Product added to cart');
    return true;
  };

  const addToCart = (variant: any) => {
    // variant comes from searchVariantByBarcode / SKU / name lookup.
    // Needs: id (variantId), productFlatId, parent.name, sku, sellingPrice, taxRate
    const variantId    = variant.id;
    const productFlatId = variant.productFlatId;
    const baseName     = variant.parent?.name ?? variant.productName ?? '';
    const suffix       = variant.variantName && variant.variantName !== 'Default'
      ? ` – ${variant.variantName}` : '';
    const displayName  = `${baseName}${suffix}`;

    const existing = cart.find((item) => item.variantId === variantId);
    if (existing) {
      setCart(cart.map((item) =>
        item.variantId === variantId ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, {
        productFlatId,
        variantId,
        name:          displayName,
        sku:           variant.sku,
        unitPrice:     variant.sellingPrice ?? variant.parent?.sellingPrice ?? 0,
        quantity:      1,
        taxRate:       variant.taxRate ?? variant.parent?.taxRate ?? 0,
        discountAmount: 0,
      }]);
    }
  };

  const removeFromCart = (variantId: string) => {
    setCart(cart.filter((item) => item.variantId !== variantId));
  };

  const updateQuantity = (variantId: string, change: number) => {
    setCart(cart.map((item) =>
      item.variantId === variantId ? { ...item, quantity: Math.max(1, item.quantity + change) } : item
    ));
  };

  const handleBarcodeSearch = async () => {
    const q = barcode.trim();
    if (!q) return;
    setSearching(true);
    setSearchResults([]);
    try {
      // 1) Exact barcode (scanner)
      const byBarcode = await window.electron.searchVariantByBarcode(q);
      if (byBarcode.success && byBarcode.data) {
        tryAddVariant(byBarcode.data);
        return;
      }

      // 2) Exact SKU / item code
      const bySku = await window.electron.searchVariantBySKU(q);
      if (bySku.success && bySku.data) {
        tryAddVariant(bySku.data);
        return;
      }

      // 3) Partial match on SKU, barcode, variant name, or product name
      const fuzzy = await window.electron.searchVariants(q, 25);
      if (fuzzy.success && Array.isArray(fuzzy.data) && fuzzy.data.length > 0) {
        if (fuzzy.data.length === 1) {
          tryAddVariant(fuzzy.data[0]);
          return;
        }
        setSearchResults(fuzzy.data);
        return;
      }

      toast.error('Product not found');
    } catch (error) {
      toast.error('Failed to search product');
    } finally {
      setSearching(false);
    }
  };

  const subtotal = cart.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unitPrice - item.discountAmount;
    return sum + itemSubtotal;
  }, 0);

  const totalTax = cart.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unitPrice - item.discountAmount;
    return sum + (itemSubtotal * item.taxRate / 100);
  }, 0);

  const total = subtotal + totalTax - discountAmount;

  const handleOpenPayment = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setPaidAmount(total);
    setPaymentOpen(true);
  };

  const handleCompleteSale = async () => {
    if (paidAmount < 0) {
      toast.error('Paid amount cannot be negative');
      return;
    }
    if (paidAmount < total && (!selectedCustomer || selectedCustomer === 'walk-in')) {
      toast.error('Credit sales must be associated with a registered customer. Please select a customer first.');
      return;
    }
    setProcessing(true);
    try {
      const saleData = {
        customerId: selectedCustomer,
        items: cart.map((item) => ({
          productId:      item.productFlatId,  // product_variant_flat.id
          variantId:      item.variantId,       // product_variant.id
          quantity:       item.quantity,
          unitPrice:      item.unitPrice,
          taxRate:        item.taxRate,
          discountAmount: item.discountAmount,
        })),
        paymentMethod,
        paidAmount,
        discountAmount,
        notes,
        userId: user?.id,
      };

      const res = await window.electron.createSale(saleData);
      if (res.success) {
        const sale = res.data || {};
        const customer = customers.find((c) => c.id === selectedCustomer);
        const invoiceItems = cart.map((item) => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          total: item.quantity * item.unitPrice - item.discountAmount,
        }));

        setInvoice({
          saleNumber: sale.saleNumber || sale.sale_number || '—',
          date: new Date(sale.saleDate || sale.createdAt || Date.now()).toLocaleString(),
          customerName: customer?.name || 'Walk-in Customer',
          customerPhone: customer?.phone,
          paymentMethod: sale.paymentMethod || paymentMethod,
          paymentStatus: sale.paymentStatus || (paidAmount >= total ? 'paid' : 'partial'),
          items: invoiceItems,
          subtotal,
          taxAmount: totalTax,
          discountAmount,
          totalAmount: sale.totalAmount ?? total,
          paidAmount: sale.paidAmount ?? paidAmount,
          changeAmount: sale.changeAmount ?? Math.max(0, paidAmount - total),
          notes: notes || undefined,
        });

        toast.success('Sale completed successfully!');
        setCart([]);
        setSelectedCustomer(undefined);
        setDiscountAmount(0);
        setNotes('');
        setPaymentOpen(false);
        setPaidAmount(0);
        setPaymentMethod('cash');
        setSearchResults([]);
        setBarcode('');
      } else {
        toast.error(res.error || 'Failed to complete sale');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintInvoice = async () => {
    if (!invoice) return;
    setPrinting(true);
    try {
      const res = await window.electron.printInvoice({
        businessName: settings.business_name || 'My Business',
        footer: settings.invoice_footer || 'Thank you for your business!',
        currencySymbol: currencySymbol || settings.currency_symbol || 'Rs.',
        ...invoice,
      });
      if (!res.success) toast.error(res.error || 'Failed to print invoice');
    } catch {
      toast.error('Failed to print invoice');
    } finally {
      setPrinting(false);
    }
  };

  const closeInvoice = () => setInvoice(null);

  const changeAmount = Math.max(0, paidAmount - total);
  const balanceDue = Math.max(0, total - paidAmount);
  const hasDueBalance = balanceDue > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Point of Sale</h1>
        <p className="text-[14.5px] text-ink/55 mt-1.5">Process customer sales</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        {/* Product Search */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Search Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={20} />
                  <Input
                    placeholder="Scan barcode, or search by SKU / product name…"
                    value={barcode}
                    onChange={(e) => {
                      setBarcode(e.target.value);
                      if (searchResults.length) setSearchResults([]);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                    className="pl-10"
                    autoFocus
                  />
                </div>
                <Button onClick={handleBarcodeSearch} disabled={searching}>
                  {searching ? '…' : 'Search'}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-3 border border-ink/[0.08] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  {searchResults.map((v) => {
                    const name = v.parent?.name ?? '—';
                    const variantLabel = [v.variantName, v.color, v.size]
                      .filter((x) => x && x !== 'Default')
                      .join(' / ');
                    const price = v.sellingPrice ?? v.parent?.sellingPrice ?? 0;
                    const out = (v.stock ?? 0) <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={out}
                        onClick={() => tryAddVariant(v)}
                        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 border-b border-ink/[0.06] last:border-0 hover:bg-ink/[0.03] disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate">{name}</p>
                          <p className="text-xs text-ink/50 mt-0.5 truncate">
                            {v.sku}
                            {variantLabel ? ` · ${variantLabel}` : ''}
                            {v.barcode ? ` · ${v.barcode}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-ink">{formatCurrency(price)}</p>
                          <p className={`text-[11px] ${out ? 'text-danger-text' : 'text-ink/45'}`}>
                            {out ? 'Out of stock' : `Stock ${v.stock}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User size={18} strokeWidth={1.6} /> Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Walk-in Customer (Default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} - {c.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Cart */}
        <div className="lg:sticky lg:top-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><ShoppingCart size={18} strokeWidth={1.6} /> Cart</span>
                {cart.length > 0 && <span className="text-sm font-normal text-ink/55">{cart.length} item(s)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-12 text-ink/50">
                  <ShoppingCart size={48} className="mx-auto mb-2 opacity-30" />
                  <p>Cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5 mb-4 max-h-80 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.variantId} className="border border-ink/[0.07] rounded-[10px] p-2.5 bg-paper/60">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-ink">{item.name}</p>
                            <p className="text-xs text-ink/50">{item.sku} • {formatCurrency(item.unitPrice)}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFromCart(item.variantId)}>
                            <Trash2 size={12} className="text-danger-text" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.variantId, -1)}>
                              <Minus size={12} />
                            </Button>
                            <span className="w-10 text-center font-medium text-sm text-ink">{item.quantity}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.variantId, 1)}>
                              <Plus size={12} />
                            </Button>
                          </div>
                          <span className="font-bold text-sm text-ink">{formatCurrency((item.quantity * item.unitPrice) - item.discountAmount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-ink/[0.08] pt-4">
                    <div className="flex justify-between text-[13.5px]">
                      <span className="text-ink/60">Subtotal</span>
                      <span className="font-semibold text-ink">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[13.5px]">
                      <span className="text-ink/60">Tax</span>
                      <span className="font-semibold text-ink">{formatCurrency(totalTax)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13.5px]">
                      <span className="text-ink/60">Discount</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        className="h-7 w-20 text-right text-sm"
                      />
                    </div>
                    <div className="flex justify-between font-display text-[19px] font-bold border-t border-ink/[0.08] pt-3">
                      <span className="text-ink">Total</span>
                      <span className="text-ink">{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <button
                    className="w-full mt-4 bg-olive text-ink text-center font-bold text-[14.5px] py-3.5 rounded-[10px] hover:bg-[#bcc65c] transition-colors"
                    onClick={handleOpenPayment}
                  >
                    Charge {formatCurrency(total)}
                  </button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={paymentOpen} onOpenChange={(o) => { if (!processing) setPaymentOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-paper rounded-[10px] p-4 space-y-2">
              <div className="flex justify-between text-sm text-ink"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-sm text-ink"><span>Tax:</span><span>{formatCurrency(totalTax)}</span></div>
              <div className="flex justify-between text-sm text-ink"><span>Discount:</span><span>-{formatCurrency(discountAmount)}</span></div>
              <div className="flex justify-between text-lg font-bold border-t border-ink/[0.08] pt-2 text-ink"><span>Total:</span><span>{formatCurrency(total)}</span></div>
            </div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount Paid</Label>
              <Input type="number" step="0.01" min={0} value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} />
            </div>
            {!hasDueBalance && (
              <div className="bg-success-bg rounded-[10px] p-3">
                <div className="flex justify-between text-lg font-semibold text-success-text">
                  <span>Change:</span>
                  <span>{formatCurrency(changeAmount)}</span>
                </div>
              </div>
            )}
            {hasDueBalance && (
              <div className="bg-warning-bg rounded-[10px] p-3 space-y-1">
                <div className="flex justify-between text-lg font-semibold text-warning-text">
                  <span>Balance Due:</span>
                  <span>{formatCurrency(balanceDue)}</span>
                </div>
                {selectedCustomer && selectedCustomer !== 'walk-in' && (
                  <p className="text-xs text-warning-text/70">This amount will be added to the customer's credit balance.</p>
                )}
                {(!selectedCustomer || selectedCustomer === 'walk-in') && (
                  <p className="text-xs text-warning-text/70">Select a named customer to track this balance.</p>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label>Notes (Optional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)} disabled={processing}>Cancel</Button>
            <Button onClick={handleCompleteSale} disabled={processing}>
              {processing ? 'Processing...' : 'Complete Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice preview after successful sale */}
      <Dialog open={!!invoice} onOpenChange={(o) => { if (!o) closeInvoice(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sale Invoice</DialogTitle>
          </DialogHeader>
          {invoice && (
            <div className="space-y-4 py-1">
              <div className="text-center border-b border-ink/[0.08] pb-3">
                <p className="font-display font-bold text-lg text-ink">
                  {settings.business_name || 'My Business'}
                </p>
                <p className="text-xs text-ink/50 mt-0.5">Sales Invoice</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-ink/50 text-xs uppercase tracking-wide">Invoice</span>
                  <p className="font-mono font-semibold text-ink">{invoice.saleNumber}</p>
                  <p className="text-xs text-ink/55">{invoice.date}</p>
                </div>
                <div>
                  <span className="text-ink/50 text-xs uppercase tracking-wide">Customer</span>
                  <p className="font-semibold text-ink">{invoice.customerName}</p>
                  {invoice.customerPhone && (
                    <p className="text-xs text-ink/55">{invoice.customerPhone}</p>
                  )}
                </div>
                <div>
                  <span className="text-ink/50 text-xs uppercase tracking-wide">Payment</span>
                  <p className="capitalize text-ink">{invoice.paymentMethod.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <span className="text-ink/50 text-xs uppercase tracking-wide">Status</span>
                  <p className="capitalize text-ink">{invoice.paymentStatus}</p>
                </div>
              </div>

              <div className="border border-ink/[0.08] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#faf9f5] border-b border-ink/[0.08]">
                      <th className="text-left py-2 px-3 text-[11px] font-bold uppercase text-ink/45">Item</th>
                      <th className="text-center py-2 px-2 text-[11px] font-bold uppercase text-ink/45">Qty</th>
                      <th className="text-right py-2 px-3 text-[11px] font-bold uppercase text-ink/45">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, i) => (
                      <tr key={i} className="border-b border-ink/[0.05]">
                        <td className="py-2 px-3">
                          <p className="font-medium text-ink">{item.name}</p>
                          <p className="text-[11px] font-mono text-ink/40">{item.sku}</p>
                        </td>
                        <td className="py-2 px-2 text-center text-ink">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-medium text-ink">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-ink/70">
                  <span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-ink/70">
                  <span>Tax</span><span>{formatCurrency(invoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-ink/70">
                  <span>Discount</span><span>-{formatCurrency(invoice.discountAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-ink/[0.08] pt-2 text-ink">
                  <span>Total</span><span>{formatCurrency(invoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-ink/70">
                  <span>Paid</span><span>{formatCurrency(invoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-success-text font-semibold">
                  <span>Change</span><span>{formatCurrency(invoice.changeAmount)}</span>
                </div>
              </div>

              {invoice.notes && (
                <p className="text-xs text-ink/55 border-t border-ink/[0.08] pt-3">
                  <span className="font-medium text-ink/70">Notes:</span> {invoice.notes}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closeInvoice}>Done</Button>
            <Button onClick={handlePrintInvoice} disabled={printing}>
              <Printer size={16} className="mr-2" />
              {printing ? 'Printing…' : 'Print Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSPage;
