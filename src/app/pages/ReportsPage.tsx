import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, FileText, TrendingUp, DollarSign, Package, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'inventory' | 'financial';
}

const ReportsPage = () => {
  const { formatCurrency } = useSettings();
  const [activeReport, setActiveReport] = useState<ReportConfig | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [reportData, setReportData] = useState<{ headers: string[]; rows: any[][]; summary?: Record<string, string | number> } | null>(null);
  const [loading, setLoading] = useState(false);

  const reportsList: ReportConfig[] = [
    // Sales
    { id: 'daily_sales', name: 'Daily Sales Report', description: 'View sales for today', category: 'sales' },
    { id: 'monthly_sales', name: 'Monthly Sales Report', description: 'View sales for current month', category: 'sales' },
    { id: 'sales_product', name: 'Sales by Product', description: 'Top selling products', category: 'sales' },
    { id: 'sales_customer', name: 'Sales by Customer', description: 'Customer purchase history', category: 'sales' },
    // Inventory
    { id: 'current_stock', name: 'Current Stock Report', description: 'All products and stock levels', category: 'inventory' },
    { id: 'low_stock', name: 'Low Stock Report', description: 'Products running low', category: 'inventory' },
    { id: 'out_of_stock', name: 'Out of Stock Report', description: 'Products out of stock', category: 'inventory' },
    { id: 'stock_movement', name: 'Stock Movement', description: 'Inventory transaction history', category: 'inventory' },
    // Financial
    { id: 'profit_loss', name: 'Profit & Loss', description: 'Revenue and expenses summary', category: 'financial' },
    { id: 'purchase_report', name: 'Purchase Report', description: 'All purchases from suppliers', category: 'financial' },
    { id: 'expense_report', name: 'Expense Report', description: 'Business expenses breakdown', category: 'financial' },
    { id: 'tax_report', name: 'Tax Report', description: 'Tax collected and paid', category: 'financial' },
  ];

  const generateReport = async (report: ReportConfig, triggerDownload = false, isInitial = false) => {
    setLoading(true);
    try {
      let headers: string[] = [];
      let rows: any[][] = [];
      let summary: Record<string, string | number> = {};

      let currentStart = startDate;
      let currentEnd = endDate;

      if (isInitial) {
        if (report.id === 'daily_sales') {
          const today = new Date().toISOString().split('T')[0];
          currentStart = today;
          currentEnd = today;
          setStartDate(today);
          setEndDate(today);
        } else if (report.id === 'monthly_sales') {
          const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
          const today = new Date().toISOString().split('T')[0];
          currentStart = firstDay;
          currentEnd = today;
          setStartDate(firstDay);
          setEndDate(today);
        }
      }

      const start = new Date(currentStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentEnd);
      end.setHours(23, 59, 59, 999);

      if (report.id === 'daily_sales' || report.id === 'monthly_sales') {
        // Fetch sales
        const res = await window.electron.getSales({ page: 1, limit: 1000 });
        if (!res.success) throw new Error(res.error);

        const filtered = res.data.data.filter((s: any) => {
          const date = new Date(s.createdAt);
          return date >= start && date <= end;
        });

        headers = ['Sale Number', 'Customer', 'Date', 'Payment Status', 'Subtotal', 'Tax', 'Discount', 'Total Amount', 'Paid Amount'];
        rows = filtered.map((s: any) => [
          s.saleNumber,
          s.customer?.name || 'Walk-in Customer',
          new Date(s.createdAt).toLocaleDateString(),
          s.paymentStatus.toUpperCase(),
          formatCurrency(s.subtotal),
          formatCurrency(s.taxAmount),
          formatCurrency(s.discountAmount),
          formatCurrency(s.totalAmount),
          formatCurrency(s.paidAmount)
        ]);

        const totalAmt = filtered.reduce((sum: number, s: any) => sum + s.totalAmount, 0);
        const totalPaid = filtered.reduce((sum: number, s: any) => sum + s.paidAmount, 0);
        summary = {
          'Total Sales': filtered.length,
          'Total Amount': formatCurrency(totalAmt),
          'Total Paid': formatCurrency(totalPaid),
          'Outstanding Balance': formatCurrency(Math.max(0, totalAmt - totalPaid))
        };
      } 
      else if (report.id === 'sales_product') {
        const res = await window.electron.getSales({ page: 1, limit: 1000 });
        if (!res.success) throw new Error(res.error);

        const productSales: Record<string, { qty: number; rev: number }> = {};
        res.data.data
          .filter((s: any) => {
            const date = new Date(s.createdAt);
            return date >= start && date <= end;
          })
          .forEach((s: any) => {
            (s.items || []).forEach((item: any) => {
              const name = item.product?.name || 'Unknown Product';
              if (!productSales[name]) productSales[name] = { qty: 0, rev: 0 };
              productSales[name].qty += item.quantity;
              productSales[name].rev += item.totalAmount;
            });
          });

        headers = ['Product Name', 'Quantity Sold', 'Total Revenue'];
        rows = Object.entries(productSales)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([name, data]) => [
            name,
            data.qty,
            formatCurrency(data.rev)
          ]);

        const totalQty = Object.values(productSales).reduce((sum, d) => sum + d.qty, 0);
        const totalRev = Object.values(productSales).reduce((sum, d) => sum + d.rev, 0);
        summary = {
          'Unique Products Sold': Object.keys(productSales).length,
          'Total Quantity Sold': totalQty,
          'Total Revenue': formatCurrency(totalRev)
        };
      }
      else if (report.id === 'sales_customer') {
        const res = await window.electron.getSales({ page: 1, limit: 1000 });
        if (!res.success) throw new Error(res.error);

        const customerSales: Record<string, { count: number; spent: number }> = {};
        res.data.data
          .filter((s: any) => {
            const date = new Date(s.createdAt);
            return date >= start && date <= end;
          })
          .forEach((s: any) => {
            const name = s.customer?.name || 'Walk-in Customer';
            if (!customerSales[name]) customerSales[name] = { count: 0, spent: 0 };
            customerSales[name].count += 1;
            customerSales[name].spent += s.totalAmount;
          });

        headers = ['Customer Name', 'Purchase Count', 'Total Spent'];
        rows = Object.entries(customerSales)
          .sort((a, b) => b[1].spent - a[1].spent)
          .map(([name, data]) => [
            name,
            data.count,
            formatCurrency(data.spent)
          ]);

        const totalSpent = Object.values(customerSales).reduce((sum, d) => sum + d.spent, 0);
        summary = {
          'Customers Served': Object.keys(customerSales).length,
          'Total Revenue': formatCurrency(totalSpent)
        };
      }
      else if (report.id === 'current_stock' || report.id === 'low_stock' || report.id === 'out_of_stock') {
        const res = await window.electron.getProducts({ page: 1, limit: 1000 });
        if (!res.success) throw new Error(res.error);

        let filtered = res.data.data;
        if (report.id === 'low_stock') {
          filtered = filtered.filter((p: any) => p.stock <= p.minimum_stock);
        } else if (report.id === 'out_of_stock') {
          filtered = filtered.filter((p: any) => p.stock === 0);
        }

        headers = ['Product Name', 'SKU', 'Barcode', 'Current Stock', 'Min Stock Level', 'Cost Price', 'Selling Price', 'Total Cost Value'];
        rows = filtered.map((p: any) => [
          p.name,
          p.sku || '-',
          p.barcode || '-',
          p.stock,
          p.minimum_stock,
          formatCurrency(p.purchase_price || 0),
          formatCurrency(p.price || 0),
          formatCurrency((p.stock || 0) * (p.purchase_price || 0))
        ]);

        const totalStockVal = filtered.reduce((sum: number, p: any) => sum + ((p.stock || 0) * (p.purchase_price || 0)), 0);
        summary = {
          'Total Products': filtered.length,
          'Total Stock Quantity': filtered.reduce((sum: number, p: any) => sum + (p.stock || 0), 0),
          'Total Inventory Cost Value': formatCurrency(totalStockVal)
        };
      }
      else if (report.id === 'stock_movement') {
        const res = await window.electron.getInventoryHistory({ page: 1, limit: 1000 });
        if (!res.success) throw new Error(res.error);

        const filtered = res.data.data.filter((h: any) => {
          const date = new Date(h.createdAt);
          return date >= start && date <= end;
        });

        headers = ['Date', 'Product', 'Type', 'Qty Change', 'Before', 'After', 'Reference', 'Notes'];
        rows = filtered.map((h: any) => [
          new Date(h.createdAt).toLocaleString(),
          h.product?.name || 'Unknown Product',
          h.type.toUpperCase(),
          h.quantityChange > 0 ? `+${h.quantityChange}` : h.quantityChange,
          h.quantityBefore,
          h.quantityAfter,
          h.reference,
          h.notes || '-'
        ]);

        summary = {
          'Total Movements Logged': filtered.length,
          'Stock Additions': filtered.filter((h: any) => h.quantityChange > 0).length,
          'Stock Deductions': filtered.filter((h: any) => h.quantityChange < 0).length
        };
      }
      else if (report.id === 'profit_loss') {
        const salesRes = await window.electron.getSales({ page: 1, limit: 1000 });
        const expensesRes = await window.electron.getExpenses({ page: 1, limit: 1000 });
        
        if (!salesRes.success) throw new Error(salesRes.error);
        if (!expensesRes.success) throw new Error(expensesRes.error);

        const filteredSales = salesRes.data.data.filter((s: any) => {
          const date = new Date(s.createdAt);
          return date >= start && date <= end;
        });

        const filteredExpenses = expensesRes.data.data.filter((e: any) => {
          const date = new Date(e.createdAt);
          return date >= start && date <= end;
        });

        let totalRevenue = 0;
        let costOfGoodsSold = 0;
        filteredSales.forEach((s: any) => {
          totalRevenue += s.totalAmount;
          (s.items || []).forEach((item: any) => {
            costOfGoodsSold += item.quantity * (item.product?.purchase_price || 0);
          });
        });

        const totalExp = filteredExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const grossProfit = totalRevenue - costOfGoodsSold;
        const netProfit = grossProfit - totalExp;

        headers = ['Financial Metric', 'Total Amount'];
        rows = [
          ['Gross Revenue (Sales)', formatCurrency(totalRevenue)],
          ['Cost of Goods Sold (COGS)', formatCurrency(costOfGoodsSold)],
          ['Gross Profit', formatCurrency(grossProfit)],
          ['Operating Expenses', formatCurrency(totalExp)],
          ['Net Profit / Loss', formatCurrency(netProfit)]
        ];

        summary = {
          'Gross Profit Margin': `${totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}%`,
          'Net Profit Margin': `${totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}%`,
          'Financial Verdict': netProfit >= 0 ? 'PROFIT' : 'LOSS'
        };
      }
      else if (report.id === 'purchase_report') {
        const res = await window.electron.getPurchases({ page: 1, limit: 1000 });
        if (!res.success) throw new Error(res.error);

        const filtered = res.data.data.filter((p: any) => {
          const date = new Date(p.purchaseDate);
          return date >= start && date <= end;
        });

        headers = ['Purchase Number', 'Supplier', 'Date', 'Status', 'Payment Status', 'Subtotal', 'Tax', 'Total Amount', 'Paid Amount', 'Balance Amount'];
        rows = filtered.map((p: any) => [
          p.purchaseNumber,
          p.supplier?.name || '-',
          new Date(p.purchaseDate).toLocaleDateString(),
          p.status.toUpperCase(),
          p.paymentStatus.toUpperCase(),
          formatCurrency(p.subtotal),
          formatCurrency(p.taxAmount),
          formatCurrency(p.totalAmount),
          formatCurrency(p.paidAmount),
          formatCurrency(p.balanceAmount)
        ]);

        const totalPur = filtered.reduce((sum: number, p: any) => sum + p.totalAmount, 0);
        summary = {
          'Total Purchases': filtered.length,
          'Total Cost Outflow': formatCurrency(totalPur),
          'Total Cost Paid': formatCurrency(filtered.reduce((sum: number, p: any) => sum + p.paidAmount, 0))
        };
      }
      else if (report.id === 'expense_report') {
        const res = await window.electron.getExpenses({ page: 1, limit: 1000 });
        if (!res.success) throw new Error(res.error);

        const filtered = res.data.data.filter((e: any) => {
          const date = new Date(e.createdAt);
          return date >= start && date <= end;
        });

        headers = ['Date', 'Category', 'Description', 'Amount'];
        rows = filtered.map((e: any) => [
          new Date(e.createdAt).toLocaleDateString(),
          e.category?.name || 'Uncategorized',
          e.description || '-',
          formatCurrency(e.amount)
        ]);

        summary = {
          'Total Expenses logged': filtered.length,
          'Total Outflow': formatCurrency(filtered.reduce((sum: number, e: any) => sum + e.amount, 0))
        };
      }
      else if (report.id === 'tax_report') {
        const salesRes = await window.electron.getSales({ page: 1, limit: 1000 });
        const purchasesRes = await window.electron.getPurchases({ page: 1, limit: 1000 });

        if (!salesRes.success) throw new Error(salesRes.error);
        if (!purchasesRes.success) throw new Error(purchasesRes.error);

        const filteredSales = salesRes.data.data.filter((s: any) => {
          const date = new Date(s.createdAt);
          return date >= start && date <= end;
        });

        const filteredPurchases = purchasesRes.data.data.filter((p: any) => {
          const date = new Date(p.purchaseDate);
          return date >= start && date <= end;
        });

        const taxCollected = filteredSales.reduce((sum: number, s: any) => sum + s.taxAmount, 0);
        const taxPaid = filteredPurchases.reduce((sum: number, p: any) => sum + p.taxAmount, 0);
        const netTaxLiability = taxCollected - taxPaid;

        headers = ['Type', 'Total Base Amount', 'Tax Amount'];
        rows = [
          ['Sales (Tax Collected)', formatCurrency(filteredSales.reduce((sum: number, s: any) => sum + s.subtotal, 0)), formatCurrency(taxCollected)],
          ['Purchases (Tax Paid)', formatCurrency(filteredPurchases.reduce((sum: number, p: any) => sum + p.subtotal, 0)), formatCurrency(taxPaid)],
          ['Net Tax Liability (Due)', '-', formatCurrency(netTaxLiability)]
        ];

        summary = {
          'Total Sales Invoices': filteredSales.length,
          'Total Purchase Invoices': filteredPurchases.length,
          'Payment Verdict': netTaxLiability >= 0 ? 'Payable to Government' : 'Tax Credit (Refundable)'
        };
      }

      if (triggerDownload) {
        // Download directly
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
          + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${report.id}_report_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Report downloaded successfully');
      } else {
        setReportData({ headers, rows, summary });
        setActiveReport(report);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportAllData = async () => {
    toast.info('Preparing database dump...');
    try {
      const salesRes = await window.electron.getSales({ page: 1, limit: 10000 });
      const prodRes = await window.electron.getProducts({ page: 1, limit: 10000 });
      
      if (salesRes.success && prodRes.success) {
        const dump = {
          exportDate: new Date().toISOString(),
          products: prodRes.data.data,
          sales: salesRes.data.data
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dump, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `ims_all_data_export_${new Date().toISOString().split('T')[0]}.json`);
        dlAnchorElem.click();
        toast.success('Database exported successfully');
      }
    } catch {
      toast.error('Failed to export system database');
    }
  };

  const categories = [
    { title: 'Sales Reports', icon: TrendingUp, list: reportsList.filter(r => r.category === 'sales') },
    { title: 'Inventory Reports', icon: Package, list: reportsList.filter(r => r.category === 'inventory') },
    { title: 'Financial Reports', icon: DollarSign, list: reportsList.filter(r => r.category === 'financial') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Reports</h1>
        <p className="text-[14.5px] text-ink/55 mt-1.5">Generate insights across your business</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <Card key={cat.title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex-none rounded-[10px] bg-paper flex items-center justify-center">
                  <cat.icon className="h-[19px] w-[19px] text-olive-deep" strokeWidth={1.5} />
                </div>
                <CardTitle>{cat.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {cat.list.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 bg-paper/50 border border-ink/[0.06] rounded-[10px] hover:border-olive transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-ink">{report.name}</p>
                      <p className="text-xs text-ink/55 mt-0.5">{report.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => generateReport(report, false, true)} disabled={loading}>
                        <FileText className="h-4 w-4 text-ink/50" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => generateReport(report, true, true)} disabled={loading}>
                        <Download className="h-4 w-4 text-ink/50" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Maintenance & Exports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={exportAllData}>
              <Download className="mr-2 h-4 w-4" />
              Backup & Export Core Data (JSON)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Report View Dialog */}
      <Dialog open={!!activeReport} onOpenChange={(open) => !open && setActiveReport(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between mr-6">
              <span>{activeReport?.name}</span>
              <span className="text-xs font-normal text-ink/55">{activeReport?.description}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Date range filters */}
          {activeReport?.id !== 'current_stock' && activeReport?.id !== 'low_stock' && activeReport?.id !== 'out_of_stock' && (
            <div className="flex items-end gap-3 p-3 bg-paper rounded-[10px] border">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/40" size={14} />
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="pl-8 h-9" />
                </div>
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">End Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/40" size={14} />
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="pl-8 h-9" />
                </div>
              </div>
              <Button size="sm" className="h-9" onClick={() => activeReport && generateReport(activeReport, false)}>
                Apply Date Filter
              </Button>
            </div>
          )}

          {/* Summary Cards */}
          {reportData?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(reportData.summary).map(([key, val]) => (
                <div key={key} className="bg-paper border rounded-[10px] p-3 text-center">
                  <span className="text-xs text-ink/55 block">{key}</span>
                  <span className="text-lg font-bold text-ink mt-1 block">{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Report Data Table */}
          {reportData && (
            <div className="border rounded-[10px] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#faf9f5] border-b text-ink/60 text-xs">
                    {reportData.headers.map((h) => (
                      <th key={h} className="py-2.5 px-4 font-bold text-left uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={reportData.headers.length} className="text-center py-8 text-ink/40">
                        No transactions found matching this criteria.
                      </td>
                    </tr>
                  ) : (
                    reportData.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b hover:bg-paper/40 text-ink/80">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2 px-4">{cell}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActiveReport(null)}>
              Close
            </Button>
            <Button onClick={() => activeReport && generateReport(activeReport, true)}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportsPage;
