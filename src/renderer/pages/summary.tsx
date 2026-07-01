import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export const SummaryPage = () => {
  const [rows, setRows] = useState<any[] | null>(null);
  const [range, setRange] = useState<Range>({ from: '', to: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = { from: range.from || undefined, to: range.to || undefined };
        const data = await window.surya.ledger.receiptsPayments(r);
        if (!cancelled) setRows(data);
      } catch (err) {
        toast.error('Failed to load', { description: (err as Error).message });
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const matches = (r: any) =>
    [r.voucher, r.partyName, r.description]
      .filter(Boolean)
      .some((v: string) => String(v).toLowerCase().includes(search.toLowerCase()));

  const collections = useMemo(
    () => (rows ?? []).filter((r) => r.kind === 'receipt' && matches(r)),
    [rows, search],
  );
  const payments = useMemo(
    () => (rows ?? []).filter((r) => r.kind === 'payment' && matches(r)),
    [rows, search],
  );

  if (rows === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3">
        <DateRangeFilter value={range} onChange={setRange} presets />
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search party, voucher, note…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="collections">
        <TabsList>
          <TabsTrigger value="collections">
            <ArrowDownCircle className="mr-1.5 h-4 w-4 text-emerald-600" />
            Collections (Debtors)
          </TabsTrigger>
          <TabsTrigger value="payments">
            <ArrowUpCircle className="mr-1.5 h-4 w-4 text-destructive" />
            Payments (Creditors)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collections">
          <TxnTable rows={collections} partyLabel="Customer" amountLabel="Received" />
        </TabsContent>
        <TabsContent value="payments">
          <TxnTable rows={payments} partyLabel="Supplier" amountLabel="Paid" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const TxnTable = ({
  rows,
  partyLabel,
  amountLabel,
}: {
  rows: any[];
  partyLabel: string;
  amountLabel: string;
}) => {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Transactions" value={String(rows.length)} />
        <Stat label={`Total ${amountLabel}`} value={formatCurrencyPaise(total)} accent />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Voucher</TableHead>
              <TableHead>{partyLabel}</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">{amountLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell className="font-medium">{r.voucher}</TableCell>
                <TableCell>{r.partyName}</TableCell>
                <TableCell className="text-muted-foreground">{r.description || '—'}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrencyPaise(r.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && <TableEmpty>No transactions in this range.</TableEmpty>}
      </Card>
    </>
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
