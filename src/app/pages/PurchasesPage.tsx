import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Plus, Search, RefreshCw, Trash2, ChevronLeft, ChevronRight, Eye, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';

interface PurchaseItem {
  productId: string;         // product_variant_flat.id (FK)
  variantId: string;         // product_variant.id — required by create_purchase_v2
  selectedFlatId: string;    // UI-only: which parent product is selected in the first dropdown
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  isNew: boolean;
  newName: string;
  sellingPrice: number;
}

const PurchasesPage = () => {
  const { formatCurrency } = useSettings();
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);   // replaces products[]
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [detailPurchase, setDetailPurchase] = useState<any>(null);

  // Pay Balance state
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const loadPurchases = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await window.electron.getPurchases({ page, limit: 20, search });
      if (res.success) {
        setPurchases(res.data.data);
        setPagination(res.data.pagination);
      } else toast.error('Failed to load purchases');
    } catch { toast.error('An error occurred'); }
    finally { setLoading(false); }
  }, [search]);

  const loadSuppliers = async () => {
    try {
      const res = await window.electron.getSuppliers({ page: 1, limit: 100 });
      if (res.success) setSuppliers(res.data.data);
    } catch {}
  };

  const loadVariantsList = async () => {
    try {
      const res = await window.electron.getVariants({ page: 1, limit: 500 });
      if (res.success) setVariants(res.data.data);
    } catch {}
  };

  useEffect(() => {
    loadPurchases();
    loadSuppliers();
    loadVariantsList();
  }, []);

  const addItem = () => {
    setItems([...items, { productId: '', variantId: '', selectedFlatId: '', productName: '', quantity: 1, unitPrice: 0, taxRate: 0, isNew: false, newName: '', sellingPrice: 0 }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items];
    if (field === 'selectedFlatId') {
      // Parent product changed — reset variant selection
      newItems[idx].selectedFlatId = value;
      newItems[idx].variantId      = '';
      newItems[idx].productId      = value;  // product_variant_flat.id
      newItems[idx].productName    = '';
    } else if (field === 'variantId') {
      // Variant selected — auto-fill names
      const v = variants.find((v) => v.id === value);
      newItems[idx].variantId   = value;
      newItems[idx].productId   = v?.productFlatId || newItems[idx].selectedFlatId;
      newItems[idx].productName = v
        ? `${v.parent?.name ?? v.productName ?? ''}${v.variantName && v.variantName !== 'Default' ? ` – ${v.variantName}` : ''}`
        : '';
    } else if (field === 'isNew') {
      newItems[idx] = { ...newItems[idx], isNew: value, productId: '', variantId: '', selectedFlatId: '', productName: '', newName: '', sellingPrice: 0 };
    } else {
      newItems[idx] = { ...newItems[idx], [field]: value };
    }
    setItems(newItems);
  };

  const viewDetail = async (id: string) => {
    try {
      const res = await window.electron.getPurchaseById(id);
      if (res.success) setDetailPurchase(res.data);
      else toast.error('Failed to load purchase details');
    } catch { toast.error('An error occurred'); }
  };

  const handleOpenPayDialog = (purchase: any) => {
    setPayAmount(Number(purchase.balanceAmount || 0));
    setPayDialogOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailPurchase || payAmount <= 0) return;
    setIsSubmittingPayment(true);
    try {
      const res = await window.electron.recordPurchasePayment({
        purchaseId: detailPurchase.id,
        amount: payAmount,
      });
      if (res.success) {
        toast.success(
          `Payment of ${formatCurrency(payAmount)} recorded. Status: ${res.data.newPaymentStatus}`
        );
        setPayDialogOpen(false);
        // Refresh both the list and the open detail view
        loadPurchases(pagination.page);
        const updated = await window.electron.getPurchaseById(detailPurchase.id);
        if (updated.success) setDetailPurchase(updated.data);
      } else {
        toast.error(res.error || 'Failed to record payment');
      }
    } catch {
      toast.error('An error occurred recording the payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    // Validate new product rows
    for (const it of items) {
      if (it.isNew && !it.newName.trim()) {
        toast.error('Please enter a product name for all new items');
        return;
      }
      if (!it.isNew && !it.variantId) {
        toast.error('Please select a variant for all existing items');
        return;
      }
    }

    try {
      // For each "new product" row, create the product + default variant first
      const resolvedItems = await Promise.all(
        items.map(async (it) => {
          if (!it.isNew) return it;
          // 1. Create parent product (product_variant_flat)
          const newProd = await window.electron.createParentProduct({
            name:          it.newName.trim(),
            sellingPrice:  it.sellingPrice || it.unitPrice,
            purchasePrice: it.unitPrice,
            taxRate:       it.taxRate || 0,
            status:        'inactive',
          });
          if (!newProd.success) throw new Error(`Failed to create product "${it.newName}"`);

          // 2. Create default variant (product_variant)
          const newVariant = await window.electron.createVariant({
            productFlatId: newProd.data.id,   // correct FK
            variantName:   'Default',
            sku:           `SKU-${Date.now().toString(36).toUpperCase()}`,
            stock:         0,
            minimumStock:  0,
            status:        'Active',
          });
          if (!newVariant.success) throw new Error(`Failed to create variant for "${it.newName}"`);

          await loadVariantsList();
          return {
            ...it,
            productId:   newProd.data.id,     // product_variant_flat.id
            variantId:   newVariant.data.id,
            productName: newProd.data.name,
          };
        })
      );

      const payload = {
        supplierId,
        purchaseDate: new Date().toISOString(),
        status: 'received',
        subtotal,
        taxAmount: totalTax,
        discountAmount: 0,
        shippingCost: 0,
        totalAmount: total,
        items: resolvedItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          taxAmount: it.quantity * it.unitPrice * (it.taxRate / 100),
          discountAmount: 0,
          totalAmount: (it.quantity * it.unitPrice) * (1 + it.taxRate / 100),
        })),
        paidAmount,
        notes: '',
        userId: user?.id,
      };

      const res = await window.electron.createPurchase(payload);
      if (res.success) {
        toast.success('Purchase created successfully');
        loadPurchases();
        handleClose();
      } else {
        toast.error(res.error || 'Failed to create purchase');
      }
    } catch (err: any) {
      toast.error(err?.message || 'An error occurred');
    }
  };

  const handleClose = () => {
    setFormOpen(false);
    setSupplierId('');
    setItems([]);
    setPaidAmount(0);
  };
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalTax = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.taxRate / 100)), 0);
  const total = subtotal + totalTax;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Purchases</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">Manage stock purchases and supplier invoices</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Purchase
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={18} />
              <Input placeholder="Search purchase number..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadPurchases()} className="pl-10" />
            </div>
            <Button variant="outline" onClick={() => loadPurchases()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-12 text-ink/55">No purchases found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Purchase #</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Supplier</th>
                      <th className="text-left py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Date</th>
                      <th className="text-right py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Total</th>
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Payment Status</th>
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Status</th>
                      <th className="text-center py-4 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => (
                      <tr key={p.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-ink/60">{p.purchaseNumber}</td>
                        <td className="py-3 px-4 text-sm font-semibold text-ink">{p.supplier.name}</td>
                        <td className="py-3 px-4 text-ink/55">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right font-bold text-ink">{formatCurrency(p.totalAmount)}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={p.paymentStatus === 'paid' ? 'success' : p.paymentStatus === 'partial' ? 'warning' : 'danger'}>{p.paymentStatus}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={p.status === 'received' ? 'success' : 'default'}>{p.status}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => viewDetail(p.id)}>
                            <Eye className="h-4 w-4 text-ink/50" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 text-sm text-ink/55">
                <span>Total: {pagination.total} purchase(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => loadPurchases(pagination.page - 1)}><ChevronLeft size={16} /></Button>
                  <span className="px-2 py-1">Page {pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadPurchases(pagination.page + 1)}><ChevronRight size={16} /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Stock Purchase</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-paper/30">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-sm text-ink">Purchase Items</h3>
                <Button type="button" size="sm" onClick={addItem}>Add Item</Button>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-white/60 space-y-3">
                    {/* Toggle: existing vs new product */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1 text-xs bg-paper rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => updateItem(idx, 'isNew', false)}
                          className={`px-3 py-1 rounded transition-colors ${
                            !item.isNew ? 'bg-ink text-white font-semibold' : 'text-ink/60 hover:text-ink'
                          }`}
                        >
                          Existing Product
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(idx, 'isNew', true)}
                          className={`px-3 py-1 rounded transition-colors ${
                            item.isNew ? 'bg-ink text-white font-semibold' : 'text-ink/60 hover:text-ink'
                          }`}
                        >
                          + New Product
                        </button>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-danger-text" onClick={() => removeItem(idx)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>

                    <div className="grid grid-cols-12 gap-3 items-end">
                      {/* Product selector or new product name */}
                      {!item.isNew ? (
                        <>
                          {/* Step 1 — Parent product */}
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Product</Label>
                            <Select value={item.selectedFlatId} onValueChange={(v) => updateItem(idx, 'selectedFlatId', v)}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select Product" /></SelectTrigger>
                              <SelectContent>
                                {/* Unique parent products, sorted A-Z */}
                                {Array.from(
                                  new Map(
                                    variants.map((v) => [
                                      v.productFlatId || v.parent?.id,
                                      { id: v.productFlatId || v.parent?.id, name: v.parent?.name ?? v.productName ?? '—' }
                                    ])
                                  ).values()
                                )
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Step 2 — Variant (grouped by color / size) */}
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Variant</Label>
                            <Select
                              value={item.variantId}
                              onValueChange={(v) => updateItem(idx, 'variantId', v)}
                              disabled={!item.selectedFlatId}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder={item.selectedFlatId ? 'Select Variant' : '—'} />
                              </SelectTrigger>
                              <SelectContent>
                                {(() => {
                                  const productVariants = variants.filter(
                                    (v) => (v.productFlatId || v.parent?.id) === item.selectedFlatId
                                  );
                                  // If only 1 variant (Default), show it simply
                                  if (productVariants.length === 1) {
                                    const v = productVariants[0];
                                    return <SelectItem key={v.id} value={v.id}>Default</SelectItem>;
                                  }
                                  // Group by color then size
                                  const grouped = productVariants.reduce<Record<string, typeof productVariants>>((acc, v) => {
                                    const group = [v.color, v.size].filter(Boolean).join(' / ') || 'Other';
                                    if (!acc[group]) acc[group] = [];
                                    acc[group].push(v);
                                    return acc;
                                  }, {});
                                  return Object.entries(grouped).map(([group, gVariants]) => (
                                    <>
                                      <div key={`g-${group}`} className="px-2 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/40">
                                        {group}
                                      </div>
                                      {gVariants.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                          {v.variantName && v.variantName !== 'Default' ? v.variantName : 'Default'}
                                          {v.sku ? ` (${v.sku})` : ''}
                                        </SelectItem>
                                      ))}
                                    </>
                                  ));
                                })()}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">New Product Name *</Label>
                            <Input placeholder="e.g. Blue Shirt XL" value={item.newName} onChange={(e) => updateItem(idx, 'newName', e.target.value)} className="h-9" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Selling Price</Label>
                            <Input type="number" step="0.01" min="0" placeholder="0" value={item.sellingPrice || ''} onChange={(e) => updateItem(idx, 'sellingPrice', parseFloat(e.target.value) || 0)} className="h-9" />
                          </div>
                        </>
                      )}
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Quantity</Label>
                        <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} className="h-9" />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Cost Price</Label>
                        <Input type="number" step="0.01" min="0" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="h-9" />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Tax Rate (%)</Label>
                        <Input type="number" min="0" value={item.taxRate} onChange={(e) => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)} className="h-9" />
                      </div>
                      {!item.isNew && <div className="col-span-1" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-[#faf9f5]">
                  <div className="space-y-2">
                    <div className="flex justify-between"><span>Subtotal:</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
                    <div className="flex justify-between"><span>Tax:</span><span className="font-semibold">{formatCurrency(totalTax)}</span></div>
                    <div className="flex justify-between text-lg border-t pt-2"><span className="font-bold">Total:</span><span className="font-bold text-primary">{formatCurrency(total)}</span></div>
                    <div className="space-y-1 pt-2">
                      <Label>Amount Paid</Label>
                      <Input type="number" step="0.01" min="0" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit">Create Purchase</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailPurchase} onOpenChange={(o) => { if (!o) { setDetailPurchase(null); setPayDialogOpen(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Purchase Details</DialogTitle></DialogHeader>
          {detailPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-ink/55">Purchase Number:</span><p className="font-mono font-semibold">{detailPurchase.purchaseNumber}</p></div>
                <div><span className="text-ink/55">Date:</span><p>{new Date(detailPurchase.purchaseDate).toLocaleString()}</p></div>
                <div><span className="text-ink/55">Supplier:</span><p className="font-semibold">{detailPurchase.supplier?.name}</p></div>
                <div>
                  <span className="text-ink/55">Payment Status:</span>
                  <p className="capitalize mt-0.5">
                    <Badge variant={detailPurchase.paymentStatus === 'paid' ? 'success' : detailPurchase.paymentStatus === 'partial' ? 'warning' : 'danger'}>
                      {detailPurchase.paymentStatus}
                    </Badge>
                  </p>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[#faf9f5] border-b">
                    <th className="text-left py-2 px-4">Product</th>
                    <th className="text-center py-2 px-4">Qty</th>
                    <th className="text-right py-2 px-4">Price</th>
                    <th className="text-right py-2 px-4">Total</th>
                  </tr></thead>
                  <tbody>
                    {(detailPurchase.items || []).map((item: any) => {
                      const parentName    = item.variant?.product?.name ?? item.product?.name ?? '—';
                      const variantSuffix = item.variant?.variant_name && item.variant.variant_name !== 'Default'
                        ? ` – ${item.variant.variant_name}` : '';
                      return (
                        <tr key={item.id} className="border-b">
                          <td className="py-2 px-4">
                            <div className="font-medium">{parentName}{variantSuffix}</div>
                            <div className="text-xs text-ink/35 font-mono">{item.variant?.sku}</div>
                          </td>
                          <td className="py-2 px-4 text-center">{item.quantity}</td>
                          <td className="py-2 px-4 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-2 px-4 text-right">{formatCurrency(item.totalAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(detailPurchase.subtotal || 0)}</span></div>
                <div className="flex justify-between"><span>Tax:</span><span>{formatCurrency(detailPurchase.taxAmount || 0)}</span></div>
                <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total:</span><span>{formatCurrency(detailPurchase.totalAmount || 0)}</span></div>
                <div className="flex justify-between"><span>Paid:</span><span>{formatCurrency(detailPurchase.paidAmount || 0)}</span></div>
                <div className="flex justify-between text-danger-text font-semibold"><span>Balance Due:</span><span>{formatCurrency(detailPurchase.balanceAmount || 0)}</span></div>
              </div>

              {/* Pay Balance — shown only when there is an outstanding balance */}
              {Number(detailPurchase.balanceAmount || 0) > 0 && !payDialogOpen && (
                <Button
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => handleOpenPayDialog(detailPurchase)}
                >
                  <DollarSign size={15} /> Pay Balance
                </Button>
              )}

              {/* Inline payment form */}
              {payDialogOpen && (
                <form onSubmit={handleSubmitPayment} className="space-y-3 border border-primary/20 rounded-lg p-4 bg-primary/5">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Record Payment</p>
                  <div className="space-y-1">
                    <Label htmlFor="pay-amount-inline">Amount to Pay</Label>
                    <Input
                      id="pay-amount-inline"
                      type="number"
                      step="0.01"
                      min={0.01}
                      max={Number(detailPurchase.balanceAmount || 0)}
                      value={payAmount}
                      onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                      required
                    />
                    <p className="text-xs text-ink/40">Max: {formatCurrency(Number(detailPurchase.balanceAmount || 0))}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setPayDialogOpen(false)} disabled={isSubmittingPayment}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isSubmittingPayment || payAmount <= 0 || payAmount > Number(detailPurchase.balanceAmount || 0)}
                    >
                      {isSubmittingPayment ? 'Recording...' : 'Confirm Payment'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchasesPage;
