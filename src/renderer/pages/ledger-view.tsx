import { useEffect, useState } from 'react';
import { Phone, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { formatCurrencyPaise, formatDate, isoToday } from '@/lib/utils';

export type LedgerKind = 'debtor' | 'creditor';

type Config = {
  kind: LedgerKind;
  partyType: 'customer' | 'supplier';
  totalLabel: string;
  oldestLabel: string;
  actionLabel: string;
  add: (input: any) => Promise<string>;
  summary: () => Promise<any>;
  aging: () => Promise<any[]>;
};

const ageVariant = (age: number | null) => {
  if (age === null) return 'secondary';
  if (age <= 30) return 'success';
  if (age <= 90) return 'warning';
  return 'danger';
};

export const LedgerView = ({ config }: { config: Config }) => {
  const [summary, setSummary] = useState<{ rows: any[]; summary: any } | null>(null);
  const [aging, setAging] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptFor, setReceiptFor] = useState<any | null>(null);
  const [ledgerFor, setLedgerFor] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([config.summary(), config.aging()]);
      setSummary(s);
      setAging(a);
    } catch (err) {
      toast.error('Failed to load ledger', { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.kind]);

  const tiles = summary?.summary ?? { total: 0, bucket0_30: 0, bucket31_90: 0, bucket90Plus: 0 };
  const agingTotals = aging.reduce(
    (acc, r) => ({
      b1: acc.b1 + r.bucket0_30,
      b2: acc.b2 + r.bucket31_60,
      b3: acc.b3 + r.bucket61_90,
      b4: acc.b4 + r.bucket90Plus,
      t: acc.t + r.total,
    }),
    { b1: 0, b2: 0, b3: 0, b4: 0, t: 0 },
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={config.totalLabel} value={tiles.total} accent />
        <Tile label="0–30 Days" value={tiles.bucket0_30} />
        <Tile label="31–90 Days" value={tiles.bucket31_90} />
        <Tile label="90+ Days" value={tiles.bucket90Plus} />
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Outstanding Summary</TabsTrigger>
          <TabsTrigger value="aging">Aging Analysis</TabsTrigger>
        </TabsList>

        {/* Tab A — Outstanding Summary */}
        <TabsContent value="summary">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{config.partyType === 'customer' ? 'Customer' : 'Supplier'}</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>{config.oldestLabel}</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary?.rows.map((r) => (
                  <TableRow key={r.partyId}>
                    <TableCell>
                      <button
                        className="font-medium text-primary hover:underline"
                        onClick={() => setLedgerFor(r)}
                      >
                        {r.name}
                      </button>
                    </TableCell>
                    <TableCell>{r.location || '—'}</TableCell>
                    <TableCell>
                      {r.phone ? (
                        <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:underline">
                          <Phone className="h-3 w-3" /> {r.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrencyPaise(r.outstanding)}
                    </TableCell>
                    <TableCell>{formatDate(r.oldestUnpaidDate)}</TableCell>
                    <TableCell>
                      <Badge variant={ageVariant(r.ageDays) as any}>
                        {r.ageDays === null ? '—' : `${r.ageDays}d`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setReceiptFor(r)}>
                        {config.actionLabel}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(summary?.rows.length ?? 0) === 0 && <TableEmpty>Nothing outstanding. All clear!</TableEmpty>}
          </Card>
        </TabsContent>

        {/* Tab B — Aging Analysis */}
        <TabsContent value="aging">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{config.partyType === 'customer' ? 'Customer' : 'Supplier'}</TableHead>
                  <TableHead className="text-right">0–30</TableHead>
                  <TableHead className="text-right">31–60</TableHead>
                  <TableHead className="text-right">61–90</TableHead>
                  <TableHead className="text-right">90+</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aging.map((r) => (
                  <TableRow key={r.partyId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(r.bucket0_30)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(r.bucket31_60)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(r.bucket61_90)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(r.bucket90Plus)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrencyPaise(r.total)}</TableCell>
                  </TableRow>
                ))}
                {aging.length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(agingTotals.b1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(agingTotals.b2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(agingTotals.b3)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(agingTotals.b4)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(agingTotals.t)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {aging.length === 0 && <TableEmpty>Nothing outstanding.</TableEmpty>}
          </Card>
        </TabsContent>
      </Tabs>

      {receiptFor && (
        <ReceiptModal
          config={config}
          party={receiptFor}
          onClose={() => setReceiptFor(null)}
          onSaved={() => {
            setReceiptFor(null);
            load();
          }}
        />
      )}
      {ledgerFor && (
        <LedgerDrawer config={config} party={ledgerFor} onClose={() => setLedgerFor(null)} />
      )}
    </div>
  );
};

const Tile = ({ label, value, accent }: { label: string; value: number; accent?: boolean }) => (
  <Card>
    <CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? 'text-primary' : ''}`}>
        {formatCurrencyPaise(value)}
      </div>
    </CardContent>
  </Card>
);

const ReceiptModal = ({
  config,
  party,
  onClose,
  onSaved,
}: {
  config: Config;
  party: any;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [date, setDate] = useState(isoToday());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    setSaving(true);
    try {
      await config.add({ partyId: party.partyId, date, amount: amt, description: description || undefined });
      toast.success(`${config.actionLabel} recorded`);
      onSaved();
    } catch (err) {
      toast.error('Save failed', { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {config.actionLabel} — {party.name}
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {config.kind === 'debtor' ? 'Outstanding Amount' : 'Amount Payable'}:{' '}
          <span className="font-semibold">{formatCurrencyPaise(party.outstanding)}</span>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Amount (₹) *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Input
              placeholder={config.kind === 'debtor' ? 'Payment received' : 'Payment made'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : `Record ${config.actionLabel.replace('Add ', '')}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LedgerDrawer = ({
  config,
  party,
  onClose,
}: {
  config: Config;
  party: any;
  onClose: () => void;
}) => {
  const [lines, setLines] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLines(await window.surya.ledger.partyEntries(config.partyType, party.partyId));
      } catch (err) {
        toast.error('Failed to load ledger', { description: (err as Error).message });
        setLines([]);
      }
    })();
  }, [config.partyType, party.partyId]);

  const balLabel = (balance: number) => {
    if (balance === 0) return '—';
    const dr = config.partyType === 'customer' ? balance > 0 : balance < 0;
    return `${formatCurrencyPaise(Math.abs(balance))} ${dr ? 'Dr' : 'Cr'}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-sm text-muted-foreground">
              {config.partyType === 'customer' ? 'Customer' : 'Supplier'} Ledger
            </div>
            <div className="text-lg font-semibold">{party.name}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          {lines === null ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatDate(l.date)}</TableCell>
                    <TableCell className="font-medium">{l.voucher}</TableCell>
                    <TableCell className="text-muted-foreground">{l.description || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.debit ? formatCurrencyPaise(l.debit) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.credit ? formatCurrencyPaise(l.credit) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {balLabel(l.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {lines !== null && lines.length === 0 && <TableEmpty>No entries.</TableEmpty>}
        </div>
      </div>
    </div>
  );
};
