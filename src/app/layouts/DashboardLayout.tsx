import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/common/Logo';
import {
  LayoutDashboard, Package, Tag, Award, Ruler, ShoppingCart,
  TrendingUp, ShoppingBag, Users, Truck, BarChart2, DollarSign,
  FileText, UserCheck, Settings,
} from 'lucide-react';

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex w-screen h-screen bg-ink overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[264px] flex-none bg-ink flex flex-col h-full">
        <div className="px-6 pt-7 pb-5">
          <Logo size={34} onDark />
        </div>

        <nav className="flex-1 overflow-y-auto px-3.5 py-1.5">
          {menuItems.map((item) => {
            const active = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded-[9px] transition-colors ${
                  active ? 'bg-paper/[0.06]' : 'hover:bg-paper/[0.06]'
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-sm ${
                    active ? 'bg-olive' : 'bg-transparent'
                  }`}
                />
                <item.icon
                  size={18}
                  strokeWidth={1.5}
                  className={`flex-none ${active ? 'text-olive' : 'text-paper/55'}`}
                />
                <span
                  className={`text-[13.5px] font-medium tracking-wide truncate ${
                    active ? 'text-paper' : 'text-paper/65'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 pt-4 pb-[22px] border-t border-paper/[0.08]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-olive flex items-center justify-center font-display font-bold text-[13px] text-ink flex-none">
              {user?.firstName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-paper truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11.5px] text-paper/45 truncate">{(user as any)?.role?.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-[12.5px] font-medium text-[#d98b6f] hover:text-[#e8a186] transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main window */}
      <div className="flex-1 h-full p-3 pr-3 pb-3 pl-0">
        <div className="bg-paper rounded-[18px] h-full overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-12 pt-11 pb-16">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
