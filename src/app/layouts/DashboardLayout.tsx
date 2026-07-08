import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, Package, Tag, Award, Ruler, ShoppingCart,
  TrendingUp, ShoppingBag, Users, Truck, BarChart2, DollarSign,
  FileText, UserCheck, Settings, LogOut, Menu, X, ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: Tag, label: 'Categories', path: '/categories' },
  { icon: Award, label: 'Brands', path: '/brands' },
  { icon: Ruler, label: 'Units', path: '/units' },
  { icon: ShoppingCart, label: 'POS', path: '/pos' },
  { icon: TrendingUp, label: 'Sales', path: '/sales' },
  { icon: ShoppingBag, label: 'Purchases', path: '/purchases' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: Truck, label: 'Suppliers', path: '/suppliers' },
  { icon: BarChart2, label: 'Inventory', path: '/inventory' },
  { icon: DollarSign, label: 'Expenses', path: '/expenses' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: UserCheck, label: 'Users', path: '/users' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col flex-shrink-0`}>
        <div className="p-3 border-b border-gray-200 flex items-center justify-between h-14">
          {sidebarOpen && <h1 className="text-lg font-bold text-primary truncate">IMS</h1>}
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="ml-auto">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {menuItems.map((item) => {
            const active = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                title={!sidebarOpen ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2 mx-2 rounded-lg transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium truncate">{item.label}</span>}
                {sidebarOpen && active && <ChevronRight size={14} className="ml-auto flex-shrink-0" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold">
              {user?.firstName?.[0]}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-gray-500 truncate">{(user as any)?.role?.name}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <Button variant="ghost" size="sm" className="w-full justify-start text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
              <LogOut size={14} className="mr-2" /> Logout
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
