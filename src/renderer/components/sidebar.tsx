import {
  LayoutDashboard,
  Truck,
  ShoppingCart,
  Tags,
  Users,
  Factory,
  Container,
  ArrowDownCircle,
  ArrowUpCircle,
  FileBarChart,
  Wallet,
  Flame,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useRouter, type Route } from '@/lib/router';
import { cn } from '@/lib/utils';

type Item = {
  key: Route['name'];
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

type Group = { heading?: string; items: Item[] };

const groups: Group[] = [
  {
    items: [{ key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard }],
  },
  {
    heading: 'Transactions',
    items: [
      { key: 'trades', label: 'Trades', path: '/trades', icon: Truck },
      { key: 'purchases', label: 'Purchases', path: '/purchases', icon: ShoppingCart },
      { key: 'sales', label: 'Sales', path: '/sales', icon: Tags },
    ],
  },
  {
    heading: 'Masters',
    items: [
      { key: 'customers', label: 'Customers', path: '/customers', icon: Users },
      { key: 'suppliers', label: 'Suppliers', path: '/suppliers', icon: Factory },
      { key: 'transporters', label: 'Transporters', path: '/transporters', icon: Container },
    ],
  },
  {
    heading: 'Ledgers',
    items: [
      { key: 'debtors', label: 'Debtors', path: '/debtors', icon: ArrowDownCircle },
      { key: 'creditors', label: 'Creditors', path: '/creditors', icon: ArrowUpCircle },
      { key: 'summary', label: 'Summary', path: '/summary', icon: Wallet },
      { key: 'reports', label: 'Reports', path: '/reports', icon: FileBarChart },
    ],
  },
];

export const Sidebar = ({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) => {
  const { route, navigate } = useRouter();
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-white/10 bg-[#0b1f44] text-blue-50 transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center gap-2 border-b border-white/10 drag-region',
          collapsed ? 'justify-center px-0' : 'px-4',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <Flame className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Surya Coal Traders</div>
            <div className="text-[10px] text-blue-200/70">Local-first trading book</div>
          </div>
        )}
      </div>

      <nav className={cn('flex flex-1 flex-col gap-2 overflow-y-auto no-drag', collapsed ? 'p-2' : 'p-3')}>
        {groups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            {!collapsed && group.heading && (
              <div className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-blue-200/50">
                {group.heading}
              </div>
            )}
            {group.items.map((item, ii) => {
              const Icon = item.icon;
              const active = !item.soon && route.name === item.key;
              return (
                <button
                  key={`${item.label}-${ii}`}
                  onClick={() => !item.soon && navigate(item.path)}
                  disabled={item.soon}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={cn(
                    'group relative flex items-center rounded-md text-sm font-medium transition-all duration-150',
                    collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2',
                    item.soon
                      ? 'cursor-not-allowed text-blue-200/30'
                      : active
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-blue-100/75 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {active && !collapsed && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-primary" />
                  )}
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      active ? 'text-primary' : 'text-blue-200/70 group-hover:text-white',
                    )}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.soon && (
                        <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-blue-200/70">
                          Soon
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/10 p-2">
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center rounded-md text-sm font-medium text-blue-100/75 transition-colors hover:bg-white/10 hover:text-white',
            collapsed ? 'w-full justify-center px-2 py-2' : 'w-full gap-2 px-3 py-2',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
        {!collapsed && (
          <div className="px-1 pt-2 text-[11px] text-blue-200/50">Data lives on this machine.</div>
        )}
      </div>
    </aside>
  );
};
