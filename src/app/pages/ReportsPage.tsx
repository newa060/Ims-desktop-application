import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, FileText, TrendingUp, DollarSign, Package } from 'lucide-react';

const ReportsPage = () => {
  const reportCategories = [
    {
      title: 'Sales Reports',
      icon: TrendingUp,
      reports: [
        { name: 'Daily Sales Report', description: 'View sales for today' },
        { name: 'Monthly Sales Report', description: 'View sales for current month' },
        { name: 'Sales by Product', description: 'Top selling products' },
        { name: 'Sales by Customer', description: 'Customer purchase history' },
      ],
    },
    {
      title: 'Inventory Reports',
      icon: Package,
      reports: [
        { name: 'Current Stock Report', description: 'All products and stock levels' },
        { name: 'Low Stock Report', description: 'Products running low' },
        { name: 'Out of Stock Report', description: 'Products out of stock' },
        { name: 'Stock Movement', description: 'Inventory transaction history' },
      ],
    },
    {
      title: 'Financial Reports',
      icon: DollarSign,
      reports: [
        { name: 'Profit & Loss', description: 'Revenue and expenses summary' },
        { name: 'Purchase Report', description: 'All purchases from suppliers' },
        { name: 'Expense Report', description: 'Business expenses breakdown' },
        { name: 'Tax Report', description: 'Tax collected and paid' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[34px] font-bold tracking-tight text-ink">Reports</h1>
        <p className="text-[14.5px] text-ink/55 mt-1.5">Generate insights across your business</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {reportCategories.map((category) => (
          <Card key={category.title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex-none rounded-[10px] bg-paper flex items-center justify-center">
                  <category.icon className="h-[19px] w-[19px] text-olive-deep" strokeWidth={1.5} />
                </div>
                <CardTitle>{category.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {category.reports.map((report) => (
                  <div
                    key={report.name}
                    className="flex items-center justify-between p-3 bg-paper/50 border border-ink/[0.06] rounded-[10px] hover:border-olive transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-ink">{report.name}</p>
                      <p className="text-xs text-ink/55 mt-0.5">{report.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost">
                        <FileText className="h-4 w-4 text-ink/50" />
                      </Button>
                      <Button size="sm" variant="ghost">
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
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Export All Data
            </Button>
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Generate Custom Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
