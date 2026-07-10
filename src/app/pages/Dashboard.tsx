import { useEffect, useState } from 'react';
import { Package, AlertTriangle, AlertCircle, DollarSign } from 'lucide-react';
import { DashboardStats } from '@/types';
import { formatCurrency } from '@/utils/date';

interface LowStockAlert {
  id: string;
  name: string;
  currentStock: number;
  minimumStock: number;
}

const buildChartPath = (values: number[]) => {
  const w = 640;
  const h = 220;
  const pad = 8;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * (w - 2 * pad) + pad;
    const y = h - pad - ((v - min) / span) * (h - 2 * pad);
    return [x, y] as const;
  });
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  return { linePath, areaPath, h };
};

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<{ date: string; sales: number }[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsRes, chartRes, lowStockRes] = await Promise.all([
        window.electron.getDashboardStats(),
        window.electron.getSalesChart(30),
        window.electron.getLowStock(),
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (chartRes.success) setChartData(chartRes.data || []);
      if (lowStockRes.success) setAlerts((lowStockRes.data || []).slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center p-8 text-ink/55">Loading dashboard...</div>;
  }

  const values = chartData.length ? chartData.map((d) => d.sales) : [0, 0];
  const { linePath, areaPath, h } = buildChartPath(values);
  const labelStep = Math.max(1, Math.floor(chartData.length / 6));
  const chartLabels = chartData.filter((_, i) => i % labelStep === 0 || i === chartData.length - 1);

  const monthlyProfit = stats?.monthlyProfit || 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-[36px] leading-[1.15] tracking-tight text-ink max-w-[620px]">
          Hi, here&apos;s what&apos;s happening in your store
        </h1>
        <p className="text-[14.5px] text-ink/55 mt-2">
          Welcome back — here&apos;s your business overview for today
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Total Products</span>
            <Package size={16} strokeWidth={1.6} className="text-ink/35" />
          </div>
          <div className="font-display font-bold text-[28px] text-ink">{stats?.totalProducts || 0}</div>
        </div>

        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Low Stock Items</span>
            <AlertTriangle size={16} strokeWidth={1.6} className="text-warning-text" />
          </div>
          <div className="font-display font-bold text-[28px] text-warning-text">{stats?.lowStockProducts || 0}</div>
        </div>

        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Out of Stock</span>
            <AlertCircle size={16} strokeWidth={1.6} className="text-danger-text" />
          </div>
          <div className="font-display font-bold text-[28px] text-danger-text">{stats?.outOfStockProducts || 0}</div>
        </div>

        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-ink/55 font-medium">Monthly Sales</span>
            <DollarSign size={16} strokeWidth={1.6} className="text-success-text" />
          </div>
          <div className="font-display font-bold text-[28px] text-success-text">
            {formatCurrency(stats?.monthlySales || 0)}
          </div>
        </div>
      </div>

      {/* Chart + side cards */}
      <div className="grid grid-cols-[2.2fr_1fr] gap-4">
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[26px_28px]">
          <div className="font-display font-bold text-[18px] text-ink mb-4">Your sales this month</div>
          <svg viewBox={`0 0 640 ${h}`} width="100%" height={h} preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9d16b" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#c9d16b" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#chartFill)" />
            <path d={linePath} fill="none" stroke="#8fa64f" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex justify-between text-[11.5px] text-ink/40 mt-1.5">
            {chartLabels.map((d) => (
              <div key={d.date}>
                {new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-ink rounded-2xl p-[22px_24px]">
            <div className="text-[13px] text-paper/60 font-medium mb-2">Total Customers</div>
            <div className="font-display font-bold text-[26px] text-olive">{stats?.totalCustomers || 0}</div>
          </div>
          <div className="bg-white border border-ink/[0.08] rounded-2xl p-[22px_24px] flex-1">
            <div className="text-[13px] text-ink/55 font-medium mb-2">Total Suppliers</div>
            <div className="font-display font-bold text-[26px] text-ink">{stats?.totalSuppliers || 0}</div>
          </div>
        </div>
      </div>

      {/* Overview + alerts */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[24px_26px]">
          <div className="font-display font-bold text-[17px] text-ink mb-4">Today&apos;s Overview</div>
          <div className="flex justify-between py-[11px] border-b border-ink/[0.06]">
            <span className="text-sm text-ink/60">Sales</span>
            <span className="text-sm font-bold text-ink">{formatCurrency(stats?.todaySales || 0)}</span>
          </div>
          <div className="flex justify-between py-[11px]">
            <span className="text-sm text-ink/60">Purchases</span>
            <span className="text-sm font-bold text-ink">{formatCurrency(stats?.todayPurchases || 0)}</span>
          </div>
        </div>

        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[24px_26px]">
          <div className="font-display font-bold text-[17px] text-ink mb-4">Monthly Overview</div>
          <div className="flex justify-between py-[9px] border-b border-ink/[0.06]">
            <span className="text-sm text-ink/60">Total Sales</span>
            <span className="text-sm font-bold text-ink">{formatCurrency(stats?.monthlySales || 0)}</span>
          </div>
          <div className="flex justify-between py-[9px] border-b border-ink/[0.06]">
            <span className="text-sm text-ink/60">Total Purchases</span>
            <span className="text-sm font-bold text-ink">{formatCurrency(stats?.monthlyPurchases || 0)}</span>
          </div>
          <div className="flex justify-between py-[9px]">
            <span className="text-sm text-ink/60">Profit</span>
            <span className={`text-sm font-bold ${monthlyProfit < 0 ? 'text-danger-text' : 'text-success-text'}`}>
              {formatCurrency(monthlyProfit)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-ink/[0.08] rounded-2xl p-[24px_26px]">
          <div className="font-display font-bold text-[17px] text-ink mb-1">Restock Alerts</div>
          <div className="text-[13px] text-ink/50 mb-3.5">
            {alerts.length} product{alerts.length === 1 ? '' : 's'} need attention
          </div>
          {alerts.length === 0 ? (
            <div className="text-sm text-ink/40 py-2">All stock levels look healthy.</div>
          ) : (
            alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-ink/[0.06] last:border-b-0">
                <span
                  className={`w-2 h-2 rounded-full flex-none ${
                    a.currentStock <= 0 ? 'bg-danger-text' : 'bg-warning-text'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink truncate">{a.name}</div>
                  <div className="text-xs text-ink/50">
                    {a.currentStock <= 0 ? 'Out of stock' : `${a.currentStock} unit(s) left · reorder at ${a.minimumStock}`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
