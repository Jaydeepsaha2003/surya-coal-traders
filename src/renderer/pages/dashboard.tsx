import { useEffect, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Truck,
  TrendingUp,
  Phone,
  Loader2,
} from 'lucide-react';
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
import { PnlChart } from '@/components/pnl-chart';
import { useRouter } from '@/lib/router';
import { formatCurrencyPaise, formatCurrencyCompactPaise, formatDate } from '@/lib/utils';

export const DashboardPage = () => {
  const { navigate } = useRouter();
  const [metrics, setMetrics] = useState<any | null>(null);
  const [pnl, setPnl] = useState<any[]>([]);
  const [whoToCall, setWhoToCall] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [m, p, w, r] = await Promise.all([
          window.surya.dashboard.metrics(),
          window.surya.dashboard.monthlyPnl(),
          window.surya.dashboard.whoToCall(6),
          window.surya.trades.recent(10),
        ]);
        setMetrics(m);
        setPnl(p);
        setWhoToCall(w);
        setRecent(r);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Total Receivable"
          value={formatCurrencyCompactPaise(metrics?.totalReceivable)}
          icon={ArrowDownCircle}
          tone="text-emerald-600"
          onClick={() => navigate('/debtors')}
        />
        <Kpi
          label="Total Payable"
          value={formatCurrencyCompactPaise(metrics?.totalPayable)}
          icon={ArrowUpCircle}
          tone="text-destructive"
          onClick={() => navigate('/creditors')}
        />
        <Kpi
          label="Total Trades"
          value={String(metrics?.totalTrades ?? 0)}
          icon={Truck}
          tone="text-primary"
          onClick={() => navigate('/trades')}
        />
        <Kpi
          label="This Month Profit"
          value={formatCurrencyCompactPaise(metrics?.thisMonthProfit)}
          icon={TrendingUp}
          tone={(metrics?.thisMonthProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Monthly P&L */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly P&amp;L</CardTitle>
            <div className="text-xs text-muted-foreground">Last 12 months</div>
          </CardHeader>
          <CardContent>
            <PnlChart data={pnl} />
          </CardContent>
        </Card>

        {/* Who to call today */}
        <Card>
          <CardHeader>
            <CardTitle>Who to Call Today</CardTitle>
            <div className="text-xs text-muted-foreground">Top debtors to follow up</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {whoToCall.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">All clear 🎉</div>
            )}
            {whoToCall.map((w) => (
              <div
                key={w.partyId}
                className="flex items-center justify-between rounded-md border p-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrencyPaise(w.outstanding)} · {w.ageDays ?? 0}d
                  </div>
                </div>
                {w.phone ? (
                  <a
                    href={`tel:${w.phone}`}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Phone className="h-3 w-3" /> Call
                  </a>
                ) : (
                  <Badge variant="secondary">No phone</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent trades */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trade No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Purchase</TableHead>
                <TableHead className="text-right">Sale</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.tradeNo}</TableCell>
                  <TableCell>{formatDate(t.date)}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{t.supplierNames || '—'}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{t.customerNames || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrencyPaise(t.totalPurchase)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrencyPaise(t.totalSale)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    <span className={t.grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                      {formatCurrencyPaise(t.grossProfit)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {recent.length === 0 && <TableEmpty>No trades recorded yet.</TableEmpty>}
        </CardContent>
      </Card>
    </div>
  );
};

const Kpi = ({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  onClick?: () => void;
}) => (
  <Card
    onClick={onClick}
    className={onClick ? 'cursor-pointer transition-colors hover:bg-accent/40' : ''}
  >
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </CardContent>
  </Card>
);
