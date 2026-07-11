import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Trash2, Plus, Minus, ShoppingCart, User } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';


interface CartItem {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  taxRate: number;
  discountAmount: number;
}

const POSPage = () => {
  const { formatCurrency } = useSettings();
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>(undefined);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

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

  const addToCart = (product: any) => {
    const existing = cart.find((item) => item.productId === product.id);
    if (existing) {
      setCart(cart.map((item) =>
        item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unitPrice: product.sellingPrice,
        quantity: 1,
        taxRate: product.taxRate || 0,
        discountAmount: 0,
      }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(cart.map((item) =>
      item.productId === productId ? { ...item, quantity: Math.max(1, item.quantity + change) } : item
    ));
  };

  const handleBarcodeSearch = async () => {
    if (!barcode.trim()) return;
    try {
      const response = await window.electron.searchProductByBarcode(barcode);
      if (response.success && response.data) {
        if (response.data.currentStock <= 0) {
          toast.error('Product out of stock!');
          return;
        }
        addToCart(response.data);
        setBarcode('');
        toast.success('Product added to cart');
      } else {
        toast.error('Product not found');
      }
    } catch (error) {
      toast.error('Failed to search product');
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
    setProcessing(true);
    try {
      const saleData = {
        customerId: selectedCustomer,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
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
        toast.success('Sale completed successfully!');
        setCart([]);
        setSelectedCustomer(undefined);
        setDiscountAmount(0);
        setNotes('');
        setPaymentOpen(false);
        setPaidAmount(0);
        setPaymentMethod('cash');
      } else {
        toast.error(res.error || 'Failed to complete sale');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setProcessing(false);
    }
  };

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
                    placeholder="Scan barcode or search product..."
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleBarcodeSearch}>Search</Button>
              </div>
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
                      <div key={item.productId} className="border border-ink/[0.07] rounded-[10px] p-2.5 bg-paper/60">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-ink">{item.name}</p>
                            <p className="text-xs text-ink/50">{item.sku} • {formatCurrency(item.unitPrice)}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFromCart(item.productId)}>
                            <Trash2 size={12} className="text-danger-text" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.productId, -1)}>
                              <Minus size={12} />
                            </Button>
                            <span className="w-10 text-center font-medium text-sm text-ink">{item.quantity}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.productId, 1)}>
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
    </div>
  );
};

export default POSPage;
