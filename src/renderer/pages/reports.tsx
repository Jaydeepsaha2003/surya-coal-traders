import { useEffect, useState } from 'react';
import { FileDown, Loader2, TrendingUp, ShoppingCart, Tags, Scale, FileText } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PnlChart } from '@/components/pnl-chart';
import { DateRangeFilter, type Range } from '@/components/date-range';
import { formatCurrencyPaise, formatDate } from '@/lib/utils';

const ageVariant = (age: number) => (age <= 30 ? 'success' : age <= 90 ? 'warning' : 'danger');

export const ReportsPage = () => {
  const [summary, setSummary] = useState<any | null>(null);
  const [pnl, setPnl] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rpExporting, setRpExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [fullExporting, setFullExporting] = useState(false);
  const [range, setRange] = useState<Range>({ from: '', to: '' });
  const [drill, setDrill] = useState<{ kind: 'customer' | 'supplier'; rows: any[] } | null>(null);

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

  const exportFullPdf = async () => {
    setFullExporting(true);
    try {
      const r = { from: range.from || undefined, to: range.to || undefined };
      const res = await window.surya.report.fullPdf(r);
      if (res.saved) toast.success('Full PDF report saved', { description: res.path });
    } catch (err) {
      toast.error('Export failed', { description: (err as Error).message });
    } finally {
      setFullExporting(false);
    }
  };

  const openDrill = async (kind: 'customer' | 'supplier') => {
    try {
      const rows = await window.surya.ledger.allOpenInvoices(kind);
      setDrill({ kind, rows });
    } catch (err) {
      toast.error('Failed to load', { description: (err as Error).message });
    }
  };

  const exportReceiptsPayments = async (fmt: 'xlsx' | 'pdf') => {
    setRpExporting(fmt);
    try {
      const r = { from: range.from || undefined, to: range.to || undefined };
      const res = await window.surya.report.receiptsPaymentsExport(r, fmt);
      if (res.saved) toast.success(`Exported ${fmt.toUpperCase()}`, { description: res.path });
    } catch (err) {
      toast.error('Export failed', { description: (err as Error).message });
    } finally {
      setRpExporting(null);
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportFullPdf} disabled={fullExporting}>
            {fullExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Full PDF (Trades + Receipts + Payments)
          </Button>
          <Button onClick={exportReport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Export to Excel
          </Button>
        </div>
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
        <Stat
          label="Total Receivable"
          value={formatCurrencyPaise(summary?.totalReceivable)}
          tone="text-emerald-600"
          onClick={() => openDrill('customer')}
        />
        <Stat
          label="Total Payable"
          value={formatCurrencyPaise(summary?.totalPayable)}
          tone="text-destructive"
          onClick={() => openDrill('supplier')}
        />
        <Stat label="Total Trades" value={String(summary?.totalTrades ?? 0)} />
        <Stat label="Avg Profit / Trade" value={formatCurrencyPaise(summary?.avgProfitPerTrade)} />
      </div>
      <div className="text-xs text-muted-foreground">
        Tip: click <span className="font-medium text-foreground">Receivable</span> or{' '}
        <span className="font-medium text-foreground">Payable</span> to see each pending invoice and
        its age.
      </div>

      {/* Receipts & Payments day-book export */}
      <Card>
        <CardHeader>
          <CardTitle>Receipts &amp; Payments summary</CardTitle>
          <div className="text-xs text-muted-foreground">
            Day-by-day collections and payments for the selected range ({rangeLabel}). Download as
            Excel or PDF.
          </div>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" onClick={() => exportReceiptsPayments('xlsx')} disabled={rpExporting !== null}>
            {rpExporting === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Excel
          </Button>
          <Button variant="outline" onClick={() => exportReceiptsPayments('pdf')} disabled={rpExporting !== null}>
            {rpExporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF
          </Button>
        </CardContent>
      </Card>

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

      {drill && (
        <InvoiceDrillModal
          kind={drill.kind}
          rows={drill.rows}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
};

const InvoiceDrillModal = ({
  kind,
  rows,
  onClose,
}: {
  kind: 'customer' | 'supplier';
  rows: any[];
  onClose: () => void;
}) => {
  const total = rows.reduce((s, r) => s + r.remaining, 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {kind === 'customer' ? 'Receivable' : 'Payable'} — pending {kind === 'customer' ? 'invoices' : 'bills'} by age
          </DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{kind === 'customer' ? 'Customer' : 'Supplier'}</TableHead>
              <TableHead>Voucher</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Age (days)</TableHead>
              <TableHead className="text-right">Pending</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.entryId}>
                <TableCell className="font-medium">{r.partyName}</TableCell>
                <TableCell>{r.voucher}</TableCell>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={ageVariant(r.ageDays) as any}>{r.ageDays}d</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrencyPaise(r.remaining)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell colSpan={4}>TOTAL</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrencyPaise(total)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {rows.length === 0 && <TableEmpty>Nothing pending.</TableEmpty>}
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: string;
  onClick?: () => void;
}) => (
  <Card
    onClick={onClick}
    className={onClick ? 'cursor-pointer transition-colors hover:bg-accent/40' : ''}
  >
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        {Icon && <Icon className={`h-4 w-4 ${tone ?? 'text-muted-foreground'}`} />}
      </div>
      <div className={`mt-2 text-xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</div>
    </CardContent>
  </Card>
);
