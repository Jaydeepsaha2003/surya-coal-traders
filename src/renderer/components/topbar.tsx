import { useState } from 'react';
import { Moon, Sun, PanelLeftClose, PanelLeftOpen, Check, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { useTheme } from './theme-provider';
import { useRouter } from '@/lib/router';

const titleFor = (name: string): string => {
  switch (name) {
    case 'dashboard':
      return 'Dashboard';
    case 'trades':
      return 'Trades';
    case 'purchases':
      return 'Purchases';
    case 'sales':
      return 'Sales';
    case 'customers':
      return 'Customers';
    case 'suppliers':
      return 'Suppliers';
    case 'transporters':
      return 'Transporters';
    case 'debtors':
      return 'Debtors';
    case 'creditors':
      return 'Creditors';
    case 'summary':
      return 'Summary';
    case 'reports':
      return 'Reports';
    default:
      return '';
  }
};

type Props = {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

export const Topbar = ({ sidebarCollapsed, onToggleSidebar }: Props) => {
  const { route } = useRouter();
  const { effectiveTheme, setTheme } = useTheme();
  const [exporting, setExporting] = useState(false);

  const exportReport = async () => {
    setExporting(true);
    try {
      const res = await window.surya.report.exportExcel();
      if (res.saved) toast.success('Report exported', { description: res.path });
    } catch (err) {
      toast.error('Export failed', { description: (err as Error).message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b px-6 drag-region">
      <div className="flex items-center gap-2 no-drag">
        <Button
          variant="ghost"
          size="icon"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleSidebar}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">{titleFor(route.name)}</h1>
      </div>
      <div className="flex items-center gap-2 no-drag">
        <span className="hidden items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:inline-flex">
          <Check className="h-3 w-3" /> Saved
        </span>
        <Button variant="outline" size="sm" onClick={exportReport} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Export
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
        >
          {effectiveTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
};
