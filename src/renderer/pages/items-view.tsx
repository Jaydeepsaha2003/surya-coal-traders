import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DateRangeFilter, type Range } from '@/components/date-range';
import { formatCurrencyPaise, formatDate } from '@/lib/utils';

type Config = {
  kind: 'purchase' | 'sale';
  partyLabel: string;
  list: () => Promise<any[]>;
};

export const ItemsView = ({ config }: { config: Config }) => {
  const [rows, setRows] = useState<any[] | null>(null);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<Range>({ from: '', to: '' });

  useEffect(() => {
    (async () => {
      try {
        setRows(await config.list());
      } catch (err) {
        toast.error('Failed to load', { description: (err as Error).message });
        setRows([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.kind]);

  const filtered = useMemo(
    () =>
      (rows ?? []).filter((r) => {
        const matchesSearch = [r.tradeNo, r.partyName, r.particulars, r.location, r.lorryNo, r.grade]
          .filter(Boolean)
          .some((v: string) => String(v).toLowerCase().includes(search.toLowerCase()));
        const matchesFrom = !range.from || r.date >= range.from;
        const matchesTo = !range.to || r.date <= range.to;
        return matchesSearch && matchesFrom && matchesTo;
      }),
    [rows, search, range.from, range.to],
  );

  const totalQty = filtered.reduce((s, r) => s + (r.qtyTons || 0), 0);
  const totalAmount = filtered.reduce((s, r) => s + (r.amount || 0), 0);

  if (rows === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Line items" value={String(filtered.length)} />
        <Stat label="Total Qty (T)" value={totalQty.toLocaleString('en-IN')} />
        <Stat
          label={config.kind === 'purchase' ? 'Total Purchase' : 'Total Sale'}
          value={formatCurrencyPaise(totalAmount)}
          accent
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3">
        <DateRangeFilter value={range} onChange={setRange} />
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Trade No</TableHead>
              <TableHead>{config.partyLabel}</TableHead>
              <TableHead>Particulars</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead className="text-right">Qty (T)</TableHead>
              <TableHead className="text-right">Rate/Ton</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell className="font-medium">{r.tradeNo}</TableCell>
                <TableCell>{r.partyName || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{r.particulars || '—'}</TableCell>
                <TableCell>{r.grade ? <Badge variant="secondary">{r.grade}</Badge> : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{r.qtyTons}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrencyPaise(r.ratePerTon)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrencyPaise(r.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <TableEmpty>
            No {config.kind} items yet. They appear here automatically from each trade.
          </TableEmpty>
        )}
      </Card>
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <Card>
    <CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${accent ? 'text-primary' : ''}`}>
        {value}
      </div>
    </CardContent>
  </Card>
);
