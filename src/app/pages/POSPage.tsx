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

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart(cart.map((item) =>
      item.productId === productId ? { ...item, discountAmount: Math.max(0, discount) } : item
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
    if (paidAmount < total) {
      toast.error('Paid amount must be at least the total amount');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
        <p className="text-gray-500 mt-1">Process customer sales</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Search */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
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
              <CardTitle className="flex items-center gap-2"><User size={18} /> Customer</CardTitle>
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
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><ShoppingCart size={18} /> Cart</span>
                {cart.length > 0 && <span className="text-sm font-normal text-gray-500">{cart.length} item(s)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart size={48} className="mx-auto mb-2 opacity-30" />
                  <p>Cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.productId} className="border rounded-lg p-2 bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.sku} • ${item.unitPrice.toFixed(2)}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFromCart(item.productId)}>
                            <Trash2 size={12} className="text-red-600" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.productId, -1)}>
                              <Minus size={12} />
                            </Button>
                            <span className="w-10 text-center font-medium text-sm">{item.quantity}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.productId, 1)}>
                              <Plus size={12} />
                            </Button>
                          </div>
                          <span className="font-semibold text-sm">${((item.quantity * item.unitPrice) - item.discountAmount).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-semibold">${totalTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        className="h-7 w-20 text-right text-sm"
                      />
                    </div>
                    <div className="flex justify-between text-lg border-t pt-2">
                      <span className="font-bold">Total</span>
                      <span className="font-bold text-primary">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  <Button className="w-full mt-4" size="lg" onClick={handleOpenPayment}>
                    Complete Sale
                  </Button>
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
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>Tax:</span><span>${totalTax.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>Discount:</span><span>-${discountAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total:</span><span className="text-primary">${total.toFixed(2)}</span></div>
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
              <Label>Amount Paid *</Label>
              <Input type="number" step="0.01" min={total} value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex justify-between text-lg font-semibold text-green-700">
                <span>Change:</span>
                <span>${changeAmount.toFixed(2)}</span>
              </div>
            </div>
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
