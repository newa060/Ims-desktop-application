import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from './app/hooks/useAuth';
import LoginPage from './app/pages/LoginPage';
import DashboardLayout from './app/layouts/DashboardLayout';
import Dashboard from './app/pages/Dashboard';
import ProductsPage from './app/pages/ProductsPage';
import CategoriesPage from './app/pages/CategoriesPage';
import BrandsPage from './app/pages/BrandsPage';
import UnitsPage from './app/pages/UnitsPage';
import POSPage from './app/pages/POSPage';
import SalesPage from './app/pages/SalesPage';
import PurchasesPage from './app/pages/PurchasesPage';
import CustomersPage from './app/pages/CustomersPage';
import SuppliersPage from './app/pages/SuppliersPage';
import InventoryPage from './app/pages/InventoryPage';
import ExpensesPage from './app/pages/ExpensesPage';
import UsersPage from './app/pages/UsersPage';
import ReportsPage from './app/pages/ReportsPage';
import SettingsPage from './app/pages/SettingsPage';
import ErrorBoundary from './app/components/common/ErrorBoundary';
import UpdateNotifier from './app/components/common/UpdateNotifier';
import './app/styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <DashboardLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/products" element={<ProductsPage />} />
                      <Route path="/categories" element={<CategoriesPage />} />
                      <Route path="/brands" element={<BrandsPage />} />
                      <Route path="/units" element={<UnitsPage />} />
                      <Route path="/pos" element={<POSPage />} />
                      <Route path="/sales" element={<SalesPage />} />
                      <Route path="/purchases" element={<PurchasesPage />} />
                      <Route path="/customers" element={<CustomersPage />} />
                      <Route path="/suppliers" element={<SuppliersPage />} />
                      <Route path="/inventory" element={<InventoryPage />} />
                      <Route path="/expenses" element={<ExpensesPage />} />
                      <Route path="/users" element={<UsersPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                  </DashboardLayout>
                </PrivateRoute>
              }
            />
          </Routes>
          <Toaster position="top-right" />
          <UpdateNotifier />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
