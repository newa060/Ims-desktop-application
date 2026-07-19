/**
 * ProductsPage — Desktop IMS
 *
 * Primary view: one row per product_variant (SKU / barcode / stock live here).
 * Expandable panel shows all sibling variants for the same parent product.
 *
 * "Add Product"  → ProductForm  → creates product_variant_flat + default variant
 * "Edit Product" → ProductForm  → updates product_variant_flat fields only
 * "Add Variant"  → VariantForm  → creates a product_variant row
 * "Edit Variant" → VariantForm  → updates a product_variant row
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Plus, Search, Edit, Trash2, RefreshCw,
  ChevronLeft, ChevronRight, Layers, ChevronUp, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import JsBarcode from 'jsbarcode';
import ProductForm from '../features/products/ProductForm';
import VariantForm from '../features/products/VariantForm';
import { useSettings } from '../contexts/SettingsContext';

// ── Badge helpers ─────────────────────────────────────────────────────────────



const getStatusBadge = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'active')                          return <Badge variant="success">Active</Badge>;
  if (s === 'draft'   || s === 'inactive')     return <Badge variant="warning">Inactive</Badge>;
  if (s === 'discontinued' || s === 'archived') return <Badge variant="danger">Archived</Badge>;
  return <Badge variant="secondary">{status || '-'}</Badge>;
};

// ── Component ─────────────────────────────────────────────────────────────────

const ProductsPage = () => {
  const { formatCurrency } = useSettings();

  // ── State ──────────────────────────────────────────────────────────────────
  const [variants,   setVariants]   = useState<any[]>([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(50);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [productFormOpen, setProductFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [variantFormOpen,    setVariantFormOpen]    = useState(false);
  const [selectedVariant,    setSelectedVariant]    = useState<any>(null);
  const [variantFormParent,  setVariantFormParent]  = useState<{ id: string; name: string } | null>(null);

  const [expandedFlatId,  setExpandedFlatId]  = useState<string | null>(null);
  const [expandedVariants, setExpandedVariants] = useState<any[]>([]);
  const [expandLoading,    setExpandLoading]    = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadVariants = useCallback(
    async (p = page, l = limit, s = search) => {
      setLoading(true);
      try {
        const res = await window.electron.getParentProducts({ page: p, limit: l, search: s });
        if (res.success) {
          setVariants(res.data.data);
          setTotal(res.data.total);
          setTotalPages(res.data.totalPages);
          setPage(res.data.page);
        } else {
          toast.error('Failed to load products');
        }
      } catch {
        toast.error('An error occurred while loading products');
      } finally {
        setLoading(false);
      }
    },
    [page, limit, search]
  );

  useEffect(() => { loadVariants(1, limit, ''); }, []);  // eslint-disable-line

  // ── Expand / collapse sibling variants ────────────────────────────────────

  const toggleExpand = async (productFlatId: string) => {
    if (expandedFlatId === productFlatId) {
      setExpandedFlatId(null);
      setExpandedVariants([]);
      return;
    }
    setExpandedFlatId(productFlatId);
    setExpandLoading(true);
    try {
      const res = await window.electron.getVariantsByProduct(productFlatId);
      if (res.success) {
        const sorted = [...(res.data || [])].sort((a, b) => 
          (b.sku || '').localeCompare(a.sku || '', undefined, { numeric: true, sensitivity: 'base' })
        );
        setExpandedVariants(sorted);
      } else {
        toast.error('Failed to load variants');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setExpandLoading(false);
    }
  };

  const refreshExpanded = async (productFlatId: string) => {
    if (expandedFlatId !== productFlatId) return;
    const res = await window.electron.getVariantsByProduct(productFlatId);
    if (res.success) {
      const sorted = [...(res.data || [])].sort((a, b) => 
        (b.sku || '').localeCompare(a.sku || '', undefined, { numeric: true, sensitivity: 'base' })
      );
      setExpandedVariants(sorted);
    }
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSearch = () => { setPage(1); loadVariants(1, limit, search); };

  const handlePageChange = (p: number) => { setPage(p); loadVariants(p, limit, search); };

  const handleLimitChange = (v: string) => {
    const l = parseInt(v);
    setLimit(l); setPage(1); loadVariants(1, l, search);
  };

  /** Open ProductForm to edit the PARENT (prices, category, name…) */
  const handleEditProduct = (v: any) => {
    setSelectedProduct({
      ...v,
      // category / brand / unit need IDs for dropdowns — use names as fallback
      category: v.category ? { id: '', name: v.category } : undefined,
      brand:    v.brand    ? { id: '', name: v.brand    } : undefined,
      unit:     v.baseUnit ? { id: '', name: v.baseUnit, shortName: v.baseUnit } : undefined,
    });
    setProductFormOpen(true);
  };

  /** Open VariantForm to edit an existing variant */
  const handleEditVariant = (v: any, productName: string) => {
    setSelectedVariant(v);
    setVariantFormParent({ id: v.productFlatId, name: productName });
    setVariantFormOpen(true);
  };

  /** Open VariantForm to add a NEW variant to an existing parent */
  const handleAddVariant = (v: any) => {
    setSelectedVariant(null);
    setVariantFormParent({
      id:   v.id,
      name: v.name,
    });
    setVariantFormOpen(true);
  };

  const handleDeleteVariant = async (id: string, label: string) => {
    if (!confirm(`Archive variant "${label}"?`)) return;
    try {
      const res = await window.electron.deleteVariant(id);
      if (res.success) {
        toast.success('Variant archived');
        loadVariants(page, limit, search);
        if (expandedFlatId) refreshExpanded(expandedFlatId);
      } else toast.error('Failed to archive variant');
    } catch { toast.error('An error occurred'); }
  };

  const handleDeleteProduct = async (productFlatId: string, name: string) => {
    if (!confirm(`Archive product "${name}" and all its variants?`)) return;
    try {
      const res = await window.electron.deleteParentProduct(productFlatId);
      if (res.success) {
        toast.success('Product archived');
        loadVariants(page, limit, search);
      } else toast.error('Failed to archive product');
    } catch { toast.error('An error occurred'); }
  };

  const handlePrintBarcode = (ev: any, productName: string) => {
    if (!ev.barcode) {
      toast.error(`Variant "${ev.variantName || 'Default'}" has no barcode. Please set a barcode first.`);
      return;
    }
    
    // Generate barcode SVG content using JSBarcode
    const container = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    container.appendChild(svg);
    
    try {
      JsBarcode(svg, ev.barcode, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        margin: 10
      });
      
      const svgHtml = container.innerHTML;
      const printContent = `
        <div style="text-align: center; font-family: sans-serif; padding: 10px; width: 280px; margin: 0 auto;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 2px;">${productName}</div>
          <div style="font-size: 12px; margin-bottom: 8px;">${ev.variantName || 'Default'} (${ev.sku})</div>
          <div>${svgHtml}</div>
        </div>
      `;
      
      window.electron.printReceipt({ content: printContent });
    } catch (error) {
      toast.error('Failed to generate barcode print payload');
      console.error(error);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const startItem = (page - 1) * limit + 1;
  const endItem   = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Products</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">One row per product — click <Layers className="inline h-3.5 w-3.5 mb-0.5" /> to manage variants</p>
        </div>
        <Button onClick={() => { setSelectedProduct(null); setProductFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* ── Filters ── */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={18} />
              <Input
                placeholder="Search by name, SKU, barcode or variant…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> Search</Button>
            <Button variant="outline" onClick={() => { setSearch(''); setPage(1); loadVariants(1, limit, ''); }}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reset
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink/55 whitespace-nowrap">Per page:</span>
              <Select value={String(limit)} onValueChange={handleLimitChange}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 200, 500].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-16 text-ink/50">
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm mt-1">
                {search ? `No results for "${search}"` : 'Click "Add Product" to create your first product'}
              </p>
            </div>
          ) : (
            <>
              {/* ── Table ── */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                      {['#', 'Product', 'Category', 'Brand',
                        'Purchase Price', 'Selling Price', 'Total Stock', 'Status', 'Actions']
                        .map((h, i) => (
                          <th
                            key={h}
                            className={`py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45
                              ${i >= 4 && i <= 5 ? 'text-right' : i >= 6 ? 'text-center' : 'text-left'}`}
                          >{h}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, idx) => {
                      const productName = v.name ?? '—';
                      const isExpanded  = expandedFlatId === v.id;

                      return (
                        <>
                          <tr key={v.id}
                            className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                            <td className="py-3 px-3 text-ink/40 text-sm">{startItem + idx}</td>
                            <td className="py-3 px-3 font-semibold text-ink max-w-[200px] truncate">
                              {productName}
                            </td>
                            <td className="py-3 px-3 text-ink/75 text-sm">{v.category ?? '—'}</td>
                            <td className="py-3 px-3 text-ink/75 text-sm">{v.brand ?? '—'}</td>
                            <td className="py-3 px-3 text-right text-ink text-sm tabular-nums">
                              {formatCurrency(v.purchasePrice ?? 0)}
                            </td>
                            <td className="py-3 px-3 text-right text-sm font-medium text-olive-deep tabular-nums">
                              {formatCurrency(v.sellingPrice ?? 0)}
                            </td>
                            <td className="py-3 px-3 text-center text-sm font-medium text-ink tabular-nums">
                              {v.totalStock ?? 0}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {getStatusBadge(v.status)}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-center gap-1">
                                {/* Expand sibling variants */}
                                <Button size="icon" variant="ghost" className="h-7 w-7"
                                  title="Show all variants for this product"
                                  onClick={() => toggleExpand(v.id)}>
                                  {isExpanded
                                    ? <ChevronUp className="h-3.5 w-3.5 text-primary" />
                                    : <Layers className="h-3.5 w-3.5 text-ink/50" />}
                                </Button>
                                {/* Edit parent product */}
                                <Button size="icon" variant="ghost" className="h-7 w-7"
                                  title="Edit product (name, price, category…)"
                                  onClick={() => handleEditProduct(v)}>
                                  <Edit className="h-3.5 w-3.5 text-ink/50" />
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* ── Expanded sibling-variant panel ── */}
                          {isExpanded && (
                            <tr key={`${v.productFlatId}-exp`} className="bg-[#faf9f5]/60">
                              <td colSpan={11} className="px-6 py-4 border-b border-ink/[0.06]">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold uppercase tracking-wider text-ink/50">
                                      All variants — {productName}
                                    </p>
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="outline"
                                        onClick={() => handleAddVariant(v)}>
                                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Variant
                                      </Button>
                                      <Button size="sm" variant="ghost"
                                        className="text-danger-text"
                                        onClick={() => handleDeleteProduct(v.id, productName)}>
                                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Archive Product
                                      </Button>
                                    </div>
                                  </div>

                                  {expandLoading ? (
                                    <div className="flex justify-center py-4">
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                                    </div>
                                  ) : expandedVariants.length === 0 ? (
                                    <p className="text-sm text-ink/50 py-2">No active variants.</p>
                                  ) : (
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-ink/45 border-b border-ink/[0.08]">
                                          {['Variant', 'SKU', 'Barcode', 'Color / Size', 'Stock', 'Min Stock', 'Actions']
                                            .map((h) => (
                                              <th key={h} className="text-left py-2 px-2 text-[11.5px] font-bold uppercase tracking-wider">{h}</th>
                                            ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {expandedVariants.map((ev: any) => (
                                          <tr key={ev.id}
                                            className="border-b border-ink/[0.04] hover:bg-white/50">
                                            <td className="py-2 px-2 font-medium text-ink">{ev.variantName ?? 'Default'}</td>
                                            <td className="py-2 px-2 text-ink/70 tabular-nums font-mono">{ev.sku}</td>
                                            <td className="py-2 px-2 font-mono text-ink/75">{ev.barcode || '—'}</td>
                                            <td className="py-2 px-2 text-ink/55">
                                              {[ev.color, ev.size].filter(Boolean).join(' / ') || '—'}
                                            </td>
                                            <td className="py-2 px-2 font-medium text-ink tabular-nums">{ev.stock}</td>
                                            <td className="py-2 px-2 text-ink/55 tabular-nums">{ev.minimumStock}</td>
                                            <td className="py-2 px-2">
                                              <div className="flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-6 w-6"
                                                  title="Print Barcode"
                                                  onClick={() => handlePrintBarcode(ev, productName)}>
                                                  <Printer className="h-3 w-3 text-ink/50" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6"
                                                  onClick={() => handleEditVariant(ev, productName)}>
                                                  <Edit className="h-3 w-3 text-ink/50" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6"
                                                  onClick={() => handleDeleteVariant(ev.id, `${productName} – ${ev.variantName}`)}>
                                                  <Trash2 className="h-3 w-3 text-danger-text" />
                                                </Button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-ink/55">
                  Showing <span className="font-semibold text-ink">{startItem}–{endItem}</span> of{' '}
                  <span className="font-semibold text-ink">{total}</span> variants
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handlePageChange(1)}>«</Button>
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
                    <ChevronLeft size={16} />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let n: number;
                    if (totalPages <= 5)          n = i + 1;
                    else if (page <= 3)           n = i + 1;
                    else if (page >= totalPages - 2) n = totalPages - 4 + i;
                    else                          n = page - 2 + i;
                    return (
                      <Button key={n} variant={n === page ? 'default' : 'outline'} size="sm"
                        className="w-9" onClick={() => handlePageChange(n)}>{n}</Button>
                    );
                  })}
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>
                    <ChevronRight size={16} />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => handlePageChange(totalPages)}>»</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Parent product form ── */}
      <ProductForm
        open={productFormOpen}
        onClose={() => { setProductFormOpen(false); setSelectedProduct(null); }}
        onSuccess={() => loadVariants(page, limit, search)}
        product={selectedProduct}
      />

      {/* ── Variant form ── */}
      {variantFormParent && (
        <VariantForm
          open={variantFormOpen}
          onClose={() => { setVariantFormOpen(false); setSelectedVariant(null); setVariantFormParent(null); }}
          onSuccess={() => {
            loadVariants(page, limit, search);
            if (expandedFlatId) refreshExpanded(expandedFlatId);
          }}
          productFlatId={variantFormParent.id}
          productName={variantFormParent.name}
          variant={selectedVariant}
        />
      )}
    </div>
  );
};

export default ProductsPage;
