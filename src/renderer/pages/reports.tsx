import { useEffect, useState } from 'react';
import { FileDown, Loader2, TrendingUp, ShoppingCart, Tags, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PnlChart } from '@/components/pnl-chart';
import { DateRangeFilter, type Range } from '@/components/date-range';
import { formatCurrencyPaise } from '@/lib/utils';

export const ReportsPage = () => {
  const [summary, setSummary] = useState<any | null>(null);
  const [pnl, setPnl] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [range, setRange] = useState<Range>({ from: '', to: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = { from: range.from || undefined, to: range.to || undefined };
      try {
        const [s, p] = await Promise.all([
          window.surya.report.summary(r),
          window.surya.dashboard.monthlyPnl(r),
        ]);
        if (cancelled) return;
        setSummary(s);
        setPnl(p);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const rangeLabel =
    range.from || range.to
      ? `${range.from || '…'} → ${range.to || '…'}`
      : 'All time';

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-4">
        <DateRangeFilter value={range} onChange={setRange} presets />
        <Button onClick={exportReport} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Export to Excel
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">
        Showing: <span className="font-medium text-foreground">{rangeLabel}</span>
        <span className="ml-2">(Receivable &amp; Payable are always current totals.)</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Sales" value={formatCurrencyPaise(summary?.totalSales)} icon={Tags} tone="text-emerald-600" />
        <Stat label="Total Purchases" value={formatCurrencyPaise(summary?.totalPurchases)} icon={ShoppingCart} tone="text-primary" />
        <Stat
          label="Total Profit"
          value={formatCurrencyPaise(summary?.totalProfit)}
          icon={TrendingUp}
          tone={(summary?.totalProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}
        />
        <Stat label="Qty Sold (T)" value={(summary?.totalQtyTons ?? 0).toLocaleString('en-IN')} icon={Scale} tone="text-sky-600" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Receivable" value={formatCurrencyPaise(summary?.totalReceivable)} tone="text-emerald-600" />
        <Stat label="Total Payable" value={formatCurrencyPaise(summary?.totalPayable)} tone="text-destructive" />
        <Stat label="Total Trades" value={String(summary?.totalTrades ?? 0)} />
        <Stat label="Avg Profit / Trade" value={formatCurrencyPaise(summary?.avgProfitPerTrade)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly P&amp;L</CardTitle>
          <div className="text-xs text-muted-foreground">
            {range.from || range.to ? rangeLabel : 'Last 12 months'}
          </div>
        </CardHeader>
        <CardContent>
          <PnlChart data={pnl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pnl.map((p) => (
                <TableRow key={p.label}>
                  <TableCell className="font-medium">{p.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrencyPaise(p.sale)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrencyPaise(p.purchase)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    <span className={p.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                      {formatCurrencyPaise(p.profit)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pnl.length === 0 && <TableEmpty>No data yet.</TableEmpty>}
        </CardContent>
      </Card>
    </div>
  );
};

const Stat = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: string;
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        {Icon && <Icon className={`h-4 w-4 ${tone ?? 'text-muted-foreground'}`} />}
      </div>
      <div className={`mt-2 text-xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</div>
    </CardContent>
  </Card>
);
