import { useEffect, useState, useCallback } from 'react';
import {
  Package,
  AlertTriangle,
  AlertCircle,
  DollarSign,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  ShoppingBag,
  X,
} from 'lucide-react';
import { DashboardStats, TopProduct, RecentTransaction } from '@/types';
import { formatCurrency } from '@/utils/date';

// ─── types ────────────────────────────────────────────────────────────────────

interface StockAlert {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minimumStock: number;
  category?: { name: string };
}

interface LowStockAlert {
  id: string;
  name: string;
  currentStock: number;
  minimumStock: number;
}

interface ChartPoint {
  date: string;
  sales: number;
  profit: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const buildChartPath = (values: number[], w = 640, h = 220, pad = 8) => {
  if (values.length < 2) values = [0, 0];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 2 * pad) + pad;
    const y = h - pad - ((v - min) / span) * (h - 2 * pad);
    return [x, y] as const;
  });
  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${pts.at(-1)![0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  return { linePath, areaPath, pts, h };
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// ─── stock modal ──────────────────────────────────────────────────────────────

interface StockModalProps {
  mode: 'low' | 'out';
  items: StockAlert[];
  onClose: () => void;
}

const StockModal = ({ mode, items, onClose }: StockModalProps) => {
  const isOut = mode === 'out';
  const title = isOut ? 'Out of Stock Products' : 'Low Stock Products';
  const empty = isOut ? 'No products are out of stock.' : 'No products are running low.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-paper rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/[0.08]">
          <div className="flex items-center gap-2.5">
            {isOut
              ? <AlertCircle size={18} strokeWidth={1.8} className="text-danger-text" />
              : <AlertTriangle size={18} strokeWidth={1.8} className="text-warning-text" />}
            <span className="font-display font-bold text-[17px] text-ink">{title}</span>
            <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${
              isOut ? 'bg-danger-text/10 text-danger-text' : 'bg-warning-text/10 text-warning-text'
            }`}>
              {items.length}
            </span>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition-colors">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* body */}
        <div className="overflow-y-auto flex-1">
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink/40">{empty}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#faf9f5]">
                <tr className="border-b border-ink/[0.08]">
                  <th className="text-left py-3 px-5 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Product</th>
                  <th className="text-left py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">SKU</th>
                  <th className="text-left py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Category</th>
                  <th className="text-right py-3 px-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Current</th>
                  <th className="text-right py-3 px-5 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">Min</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-ink/[0.05] hover:bg-ink/[0.02]">
                    <td className="py-3 px-5 font-medium text-ink">{p.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-ink/50">{p.sku}</td>
                    <td className="py-3 px-4 text-ink/55">{p.category?.name ?? '—'}</td>
                    <td className={`py-3 px-4 text-right font-bold ${isOut ? 'text-danger-text' : 'text-warning-text'}`}>
                      {p.currentStock}
                    </td>
                    <td className="py-3 px-5 text-right text-ink/45">{p.minimumStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};



const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-ink/[0.06] rounded-lg ${className}`} />
);

// ─── component ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [allStockAlerts, setAllStockAlerts] = useState<StockAlert[]>([]);
  const [stockModal, setStockModal] = useState<'low' | 'out' | null>(null);
  const [chartMode, setChartMode] = useState<'sales' | 'profit'>('sales');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [statsRes, chartRes, lowStockRes, topProductsRes, recentTxRes] = await Promise.all([
        window.electron.getDashboardStats(),
        window.electron.getSalesChart(30),
        window.electron.getLowStock(),
        window.electron.getTopProducts(5),
        window.electron.getRecentTransactions(8),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (chartRes.success) setChartData(chartRes.data || []);
      if (lowStockRes.success) {
        const all: StockAlert[] = lowStockRes.data || [];
        setAllStockAlerts(all);
        setAlerts(all.slice(0, 5));
      }
      if (topProductsRes.success) setTopProducts(topProductsRes.data || []);
      if (recentTxRes.success) setRecentTransactions(recentTxRes.data || []);

      if (!statsRes.success) setError('Failed to load dashboard statistics.');
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('An unexpected error occurred while loading the dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ── chart ──────────────────────────────────────────────────────────────────

  const chartValues = chartData.map((d) => d[chartMode]);
  const { linePath, areaPath, pts, h: chartH } = buildChartPath(chartValues);
  const labelStep = Math.max(1, Math.floor(chartData.length / 6));
  const chartLabels = chartData.filter((_, i) => i % labelStep === 0 || i === chartData.length - 1);

  const isProfit = chartMode === 'profit';
  const chartColor = isProfit ? '#8fa64f' : '#5b8dee';
  const chartFill = isProfit ? '#c9d16b' : '#93b4f0';

  // ── loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-5">
        <div>
          <Skeleton className="h-10 w-[520px] mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-[2.2fr_1fr] gap-4">
          <Skeleton className="h-72 rounded-2xl" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="flex-1 rounded-2xl" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const monthlyProfit = stats?.monthlyProfit ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-[36px] leading-[1.15] tracking-tight text-ink max-w-[620px]">
            Hi, here&apos;s what&apos;s happening in your store
          </h1>
          <p className="text-[14.5px] text-ink/55 mt-2">
            Welcome back — here&apos;s your business overview for today
          </p>
        </div>
        <button
          onClick={() => loadDashboardData(true)}
          disabled={refreshing}
          className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-ink/50 hover:text-ink transition-colors disabled:opacity-40"
          title="Refresh dashboard"
        >
          <RefreshCw size={14} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-danger-text/10 border border-danger-text/20 rounded-xl px-4 py-3 text-[13px] text-danger-text">
          {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Total Products</span>
            <Package size={16} strokeWidth={1.6} className="text-ink/35" />
          </div>
          <div className="font-display font-bold text-[28px] text-ink">
            {stats?.totalProducts ?? 0}
          </div>
        </div>

        <div
          onClick={() => setStockModal('low')}
          className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px] cursor-pointer hover:border-warning-text/40 hover:shadow-sm transition-all"
          title="Click to see all low stock products"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Low Stock Items</span>
            <AlertTriangle size={16} strokeWidth={1.6} className="text-warning-text" />
          </div>
          <div className="font-display font-bold text-[28px] text-warning-text">
            {stats?.lowStockProducts ?? 0}
          </div>
        </div>

        <div
          onClick={() => setStockModal('out')}
          className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px] cursor-pointer hover:border-danger-text/40 hover:shadow-sm transition-all"
          title="Click to see all out of stock products"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Out of Stock</span>
            <AlertCircle size={16} strokeWidth={1.6} className="text-danger-text" />
          </div>
          <div className="font-display font-bold text-[28px] text-danger-text">
            {stats?.outOfStockProducts ?? 0}
          </div>
        </div>

        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Monthly Sales</span>
            <DollarSign size={16} strokeWidth={1.6} className="text-success-text" />
          </div>
          <div className="font-display font-bold text-[28px] text-success-text">
            {formatCurrency(stats?.monthlySales ?? 0)}
          </div>
        </div>
      </div>

      {/* Chart + side cards */}
      <div className="grid grid-cols-[2.2fr_1fr] gap-4">
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[26px_28px]">
          <div className="flex items-center justify-between mb-4">
            <div className="font-display font-bold text-[18px] text-ink">
              {isProfit ? 'Profit trend — last 30 days' : 'Sales trend — last 30 days'}
            </div>
            <div className="flex gap-1 bg-ink/[0.04] rounded-lg p-1">
              <button
                onClick={() => setChartMode('sales')}
                className={`text-[12px] font-medium px-3 py-1 rounded-md transition-colors ${
                  !isProfit
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-ink/45 hover:text-ink/70'
                }`}
              >
                Sales
              </button>
              <button
                onClick={() => setChartMode('profit')}
                className={`text-[12px] font-medium px-3 py-1 rounded-md transition-colors ${
                  isProfit
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-ink/45 hover:text-ink/70'
                }`}
              >
                Profit
              </button>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-ink/40">
              No data for the selected period.
            </div>
          ) : (
            <>
              <svg
                viewBox={`0 0 640 ${chartH}`}
                width="100%"
                height={chartH}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartFill} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={chartFill} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#chartFill)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke={chartColor}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* data-point dots on hover — rendered as title tooltips */}
                {pts.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt[0]}
                    cy={pt[1]}
                    r={3.5}
                    fill={chartColor}
                    fillOpacity={0}
                    className="hover:fill-opacity-100 transition-all cursor-pointer"
                  >
                    <title>
                      {fmt(chartData[i].date)}: {formatCurrency(chartValues[i])}
                    </title>
                  </circle>
                ))}
              </svg>
              <div className="flex justify-between text-[11.5px] text-ink/40 mt-1.5">
                {chartLabels.map((d) => (
                  <div key={d.date}>{fmt(d.date)}</div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-ink rounded-2xl p-[22px_24px]">
            <div className="text-[13px] text-paper/60 font-medium mb-2">Total Customers</div>
            <div className="font-display font-bold text-[26px] text-olive">
              {stats?.totalCustomers ?? 0}
            </div>
          </div>
          <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px] flex-1">
            <div className="text-[13px] text-ink/55 font-medium mb-2">Total Suppliers</div>
            <div className="font-display font-bold text-[26px] text-ink">
              {stats?.totalSuppliers ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Overview + alerts + top products */}
      <div className="grid grid-cols-3 gap-4">
        {/* Today + Monthly overview */}
        <div className="space-y-4">
          <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
            <div className="font-display font-bold text-[17px] text-ink mb-3">Today&apos;s Overview</div>
            <div className="flex justify-between items-center py-[10px] border-b border-ink/[0.06]">
              <div className="flex items-center gap-2 text-sm text-ink/60">
                <ShoppingCart size={14} strokeWidth={1.6} />
                Sales
              </div>
              <span className="text-sm font-bold text-ink">
                {formatCurrency(stats?.todaySales ?? 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-[10px]">
              <div className="flex items-center gap-2 text-sm text-ink/60">
                <ShoppingBag size={14} strokeWidth={1.6} />
                Purchases
              </div>
              <span className="text-sm font-bold text-ink">
                {formatCurrency(stats?.todayPurchases ?? 0)}
              </span>
            </div>
          </div>

          <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
            <div className="font-display font-bold text-[17px] text-ink mb-3">Monthly Overview</div>
            <div className="flex justify-between py-[9px] border-b border-ink/[0.06]">
              <span className="text-sm text-ink/60">Total Sales</span>
              <span className="text-sm font-bold text-ink">
                {formatCurrency(stats?.monthlySales ?? 0)}
              </span>
            </div>
            <div className="flex justify-between py-[9px] border-b border-ink/[0.06]">
              <span className="text-sm text-ink/60">Total Purchases</span>
              <span className="text-sm font-bold text-ink">
                {formatCurrency(stats?.monthlyPurchases ?? 0)}
              </span>
            </div>
            <div className="flex justify-between py-[9px]">
              <span className="text-sm text-ink/60">Profit</span>
              <span
                className={`text-sm font-bold flex items-center gap-1 ${
                  monthlyProfit < 0 ? 'text-danger-text' : 'text-success-text'
                }`}
              >
                {monthlyProfit < 0 ? (
                  <TrendingDown size={13} strokeWidth={2} />
                ) : (
                  <TrendingUp size={13} strokeWidth={2} />
                )}
                {formatCurrency(monthlyProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Restock Alerts */}
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[24px_26px]">
          <div className="font-display font-bold text-[17px] text-ink mb-1">Restock Alerts</div>
          <div className="text-[13px] text-ink/50 mb-3.5">
            {alerts.length} product{alerts.length === 1 ? '' : 's'} need attention
          </div>
          {alerts.length === 0 ? (
            <div className="text-sm text-ink/40 py-2">All stock levels look healthy.</div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 py-2.5 border-b border-ink/[0.06] last:border-b-0"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-none ${
                    a.currentStock <= 0 ? 'bg-danger-text' : 'bg-warning-text'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink truncate">{a.name}</div>
                  <div className="text-xs text-ink/50">
                    {a.currentStock <= 0
                      ? 'Out of stock'
                      : `${a.currentStock} unit(s) left · reorder at ${a.minimumStock}`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[24px_26px]">
          <div className="font-display font-bold text-[17px] text-ink mb-1">Top Products</div>
          <div className="text-[13px] text-ink/50 mb-3.5">Best sellers this period</div>
          {topProducts.length === 0 ? (
            <div className="text-sm text-ink/40 py-2">No sales data available yet.</div>
          ) : (
            topProducts.map((p, idx) => (
              <div
                key={p.productId}
                className="flex items-center gap-3 py-2.5 border-b border-ink/[0.06] last:border-b-0"
              >
                <span className="w-5 h-5 rounded-full bg-ink/[0.05] flex items-center justify-center text-[11px] font-bold text-ink/50 flex-none">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink truncate">
                    {p.productName}
                  </div>
                  <div className="text-xs text-ink/50">{p.quantitySold} units sold</div>
                </div>
                <div className="text-[13px] font-bold text-ink flex-none">
                  {formatCurrency(p.totalRevenue)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border border-ink/[0.08] rounded-2xl p-[24px_28px]">
        <div className="font-display font-bold text-[17px] text-ink mb-4">Recent Transactions</div>
        {recentTransactions.length === 0 ? (
          <div className="text-sm text-ink/40 py-2">No recent transactions found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink/[0.06]">
                <th className="text-left text-[12px] font-semibold text-ink/45 pb-2.5">Ref #</th>
                <th className="text-left text-[12px] font-semibold text-ink/45 pb-2.5">Type</th>
                <th className="text-left text-[12px] font-semibold text-ink/45 pb-2.5">Date</th>
                <th className="text-right text-[12px] font-semibold text-ink/45 pb-2.5">Amount</th>
                <th className="text-right text-[12px] font-semibold text-ink/45 pb-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx) => (
                <tr
                  key={`${tx.type}-${tx.id}`}
                  className="border-b border-ink/[0.04] last:border-b-0"
                >
                  <td className="py-2.5 text-[13px] font-medium text-ink">{tx.number}</td>
                  <td className="py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-0.5 rounded-full ${
                        tx.type === 'sale'
                          ? 'bg-success-text/10 text-success-text'
                          : 'bg-ink/[0.06] text-ink/60'
                      }`}
                    >
                      {tx.type === 'sale' ? (
                        <TrendingUp size={10} strokeWidth={2.5} />
                      ) : (
                        <ShoppingBag size={10} strokeWidth={2.5} />
                      )}
                      {tx.type === 'sale' ? 'Sale' : 'Purchase'}
                    </span>
                  </td>
                  <td className="py-2.5 text-[13px] text-ink/55">
                    {new Date(tx.date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-2.5 text-right text-[13px] font-bold text-ink">
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`text-[11.5px] font-semibold capitalize px-2 py-0.5 rounded-full ${
                        tx.status === 'completed'
                          ? 'bg-success-text/10 text-success-text'
                          : tx.status === 'pending'
                          ? 'bg-warning-text/10 text-warning-text'
                          : 'bg-ink/[0.06] text-ink/50'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Stock detail modal */}
      {stockModal && (
        <StockModal
          mode={stockModal}
          items={allStockAlerts.filter((p) =>
            stockModal === 'out' ? p.currentStock === 0 : p.currentStock > 0
          )}
          onClose={() => setStockModal(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
