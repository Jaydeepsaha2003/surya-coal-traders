import * as React from 'react';

// Tiny hash-based router.
//   #/            Dashboard
//   #/trades      Trades
//   #/customers   Customers
//   #/suppliers   Suppliers
//   #/transporters Transporters
//   #/debtors     Debtors ledger
//   #/creditors   Creditors ledger

export type Route =
  | { name: 'dashboard' }
  | { name: 'trades' }
  | { name: 'purchases' }
  | { name: 'sales' }
  | { name: 'customers' }
  | { name: 'suppliers' }
  | { name: 'transporters' }
  | { name: 'debtors' }
  | { name: 'creditors' }
  | { name: 'summary' }
  | { name: 'reports' };

const parse = (hash: string): Route => {
  const h = hash.replace(/^#/, '');
  if (!h || h === '/') return { name: 'dashboard' };
  const parts = h.split('/').filter(Boolean);
  switch (parts[0]) {
    case 'trades':
      return { name: 'trades' };
    case 'purchases':
      return { name: 'purchases' };
    case 'sales':
      return { name: 'sales' };
    case 'customers':
      return { name: 'customers' };
    case 'suppliers':
      return { name: 'suppliers' };
    case 'transporters':
      return { name: 'transporters' };
    case 'debtors':
      return { name: 'debtors' };
    case 'creditors':
      return { name: 'creditors' };
    case 'summary':
      return { name: 'summary' };
    case 'reports':
      return { name: 'reports' };
    default:
      return { name: 'dashboard' };
  }
};

const RouterContext = React.createContext<{
  route: Route;
  navigate: (path: string) => void;
} | null>(null);

export const RouterProvider = ({ children }: { children: React.ReactNode }) => {
  const [route, setRoute] = React.useState<Route>(() => parse(window.location.hash));

  React.useEffect(() => {
    const handler = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = React.useCallback((path: string) => {
    const target = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : '/' + path}`;
    if (window.location.hash === target) setRoute(parse(target));
    else window.location.hash = target;
  }, []);

  return <RouterContext.Provider value={{ route, navigate }}>{children}</RouterContext.Provider>;
};

export const useRouter = () => {
  const ctx = React.useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider');
  return ctx;
};
