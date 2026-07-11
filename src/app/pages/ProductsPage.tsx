import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Search, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import ProductForm from '../features/products/ProductForm';
import { useSettings } from '../contexts/SettingsContext';


const getStockBadge = (current: number, minimum: number) => {
  if (current === 0) return <Badge variant="danger">Out of Stock</Badge>;
  if (current <= minimum) return <Badge variant="warning">Low Stock</Badge>;
  return <Badge variant="success">In Stock</Badge>;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge variant="success">Active</Badge>;
    case 'inactive':
      return <Badge variant="warning">Inactive</Badge>;
    case 'discontinued':
      return <Badge variant="danger">Discontinued</Badge>;
    default:
      return <Badge variant="secondary">{status || '-'}</Badge>;
  }
};

const ProductsPage = () => {
  const { formatCurrency } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadProducts = useCallback(async (currentPage = page, currentLimit = limit, currentSearch = search) => {
    setLoading(true);
    try {
      const response = await window.electron.getProducts({
        page: currentPage,
        limit: currentLimit,
        search: currentSearch,
      });
      if (response.success) {
        setProducts(response.data.data);
        setTotal(response.data.total);
        setTotalPages(response.data.totalPages);
        setPage(response.data.page);
      } else {
        toast.error('Failed to load products');
      }
    } catch {
      toast.error('An error occurred while loading products');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    loadProducts(1, limit, search);
  }, []);

  const handleSearch = () => {
    setPage(1);
    loadProducts(1, limit, search);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadProducts(newPage, limit, search);
  };

  const handleLimitChange = (newLimit: string) => {
    const l = parseInt(newLimit);
    setLimit(l);
    setPage(1);
    loadProducts(1, l, search);
  };

  const handleEdit = (product: any) => {
    setSelectedProduct(product);
    setFormOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const response = await window.electron.deleteProduct(id);
      if (response.success) {
        toast.success('Product deleted');
        loadProducts(page, limit, search);
      } else {
        toast.error('Failed to delete product');
      }
    } catch {
      toast.error('An error occurred');
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedProduct(null);
  };

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Products</h1>
          <p className="text-[14.5px] text-ink/55 mt-1.5">Manage your product inventory</p>
        </div>
        <Button onClick={() => { setSelectedProduct(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Search + Controls */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={18} />
              <Input
                placeholder="Search by name, SKU or barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
            <Button variant="outline" onClick={() => {
              setSearch('');
              setPage(1);
              loadProducts(1, limit, '');
            }}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reset
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink/55 whitespace-nowrap">Per page:</span>
              <Select value={String(limit)} onValueChange={handleLimitChange}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 text-ink/50">
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm mt-1">
                {search ? `No results for "${search}"` : 'Click "Add Product" to create your first product'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/[0.08] bg-[#faf9f5]">
                      <th className="text-left py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">#</th>
                      <th className="text-left py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Product</th>
                      <th className="text-left py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">SKU</th>
                      <th className="text-left py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Category</th>
                      <th className="text-left py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Brand</th>
                      <th className="text-right py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Purchase</th>
                      <th className="text-right py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Selling</th>
                      <th className="text-center py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Stock</th>
                      <th className="text-center py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Stock Status</th>
                      <th className="text-center py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Status</th>
                      <th className="text-center py-4 px-3 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product, index) => (
                      <tr key={product.id} className="border-b border-ink/[0.06] hover:bg-[#faf9f5] transition-colors">
                        <td className="py-3 px-3 text-ink/40 text-xs">{startItem + index}</td>
                        <td className="py-3 px-3 font-semibold text-ink max-w-[200px] truncate">{product.name}</td>
                        <td className="py-3 px-3 text-ink/55 font-mono text-xs">{product.sku}</td>
                        <td className="py-3 px-3 text-ink/55 text-xs">{product.category?.name || '-'}</td>
                        <td className="py-3 px-3 text-ink/55 text-xs">{product.brand?.name || '-'}</td>
                        <td className="py-3 px-3 text-right text-ink text-xs">{formatCurrency(product.purchasePrice)}</td>
                        <td className="py-3 px-3 text-right font-bold text-olive-deep text-xs">
                          {formatCurrency(product.sellingPrice)}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-ink text-xs">{product.currentStock}</td>
                        <td className="py-2 px-3 text-center">
                          {getStockBadge(product.currentStock, product.minimumStock)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {getStatusBadge(product.status)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(product)}>
                              <Edit className="h-3.5 w-3.5 text-ink/50" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(product.id, product.name)}>
                              <Trash2 className="h-3.5 w-3.5 text-danger-text" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-ink/55">
                  Showing <span className="font-semibold text-ink">{startItem}–{endItem}</span> of{' '}
                  <span className="font-semibold text-ink">{total}</span> products
                </div>

                <div className="flex items-center gap-1">
                  {/* First page */}
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handlePageChange(1)}>
                    «
                  </Button>
                  {/* Previous */}
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
                    <ChevronLeft size={16} />
                  </Button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === page ? 'default' : 'outline'}
                        size="sm"
                        className="w-9"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  {/* Next */}
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>
                    <ChevronRight size={16} />
                  </Button>
                  {/* Last page */}
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => handlePageChange(totalPages)}>
                    »
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ProductForm
        open={formOpen}
        onClose={handleFormClose}
        onSuccess={() => loadProducts(page, limit, search)}
        product={selectedProduct}
      />
    </div>
  );
};

export default ProductsPage;
