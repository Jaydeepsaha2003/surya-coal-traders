import { useState } from 'react';
import { RouterProvider, useRouter } from './lib/router';
import { Sidebar } from './components/sidebar';
import { Topbar } from './components/topbar';
import { DashboardPage } from './pages/dashboard';
import { TradesPage } from './pages/trades';
import { PurchasesPage } from './pages/purchases';
import { SalesPage } from './pages/sales';
import { CustomersPage } from './pages/customers';
import { SuppliersPage } from './pages/suppliers';
import { TransportersPage } from './pages/transporters';
import { DebtorsPage } from './pages/debtors';
import { CreditorsPage } from './pages/creditors';
import { ReportsPage } from './pages/reports';

const PageSwitch = () => {
  const { route } = useRouter();
  switch (route.name) {
    case 'dashboard':
      return <DashboardPage />;
    case 'trades':
      return <TradesPage />;
    case 'purchases':
      return <PurchasesPage />;
    case 'sales':
      return <SalesPage />;
    case 'customers':
      return <CustomersPage />;
    case 'suppliers':
      return <SuppliersPage />;
    case 'transporters':
      return <TransportersPage />;
    case 'debtors':
      return <DebtorsPage />;
    case 'creditors':
      return <CreditorsPage />;
    case 'reports':
      return <ReportsPage />;
  }
};

const SIDEBAR_COLLAPSED_KEY = 'surya.sidebarCollapsed';

const Shell = () => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar sidebarCollapsed={collapsed} onToggleSidebar={toggle} />
        <main className="flex-1 overflow-auto bg-background">
          <div className="mx-auto w-full p-6">
            <PageSwitch />
          </div>
        </main>
      </div>
    </div>
  );
};

export const App = () => (
  <RouterProvider>
    <Shell />
  </RouterProvider>
);
