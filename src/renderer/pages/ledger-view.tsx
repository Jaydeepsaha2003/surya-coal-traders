import { useEffect, useState } from 'react';
import { Phone, X, Loader2, Pencil, Trash2, Search } from 'lucide-react';
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
import { cn, formatCurrencyPaise, formatDate, isoToday } from '@/lib/utils';

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
  const [search, setSearch] = useState('');
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

  const tiles = summary?.summary ?? {
    total: 0,
    bucket0_30: 0,
    bucket31_90: 0,
    bucket90Plus: 0,
    advance: 0,
  };
  const nameMatch = (n: string) => n.toLowerCase().includes(search.toLowerCase());
  const summaryRows = (summary?.rows ?? []).filter((r: any) => nameMatch(r.name));
  const agingRows = aging.filter((r) => nameMatch(r.name));
  const agingTotals = agingRows.reduce(
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
      {tiles.advance > 0 && (
        <div className="text-xs text-muted-foreground">
          {formatCurrencyPaise(tiles.advance)} held as on-account / advance (received but not yet
          matched to an {config.kind === 'debtor' ? 'invoice' : 'bill'}).
        </div>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${config.partyType === 'customer' ? 'customers' : 'suppliers'}…`}
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                {summaryRows.map((r: any) => (
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
            {summaryRows.length === 0 && <TableEmpty>Nothing outstanding. All clear!</TableEmpty>}
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
                {agingRows.map((r) => (
                  <TableRow key={r.partyId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(r.bucket0_30)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(r.bucket31_60)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(r.bucket61_90)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyPaise(r.bucket90Plus)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrencyPaise(r.total)}</TableCell>
                  </TableRow>
                ))}
                {agingRows.length > 0 && (
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
            {agingRows.length === 0 && <TableEmpty>Nothing outstanding.</TableEmpty>}
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
        <LedgerDrawer
          config={config}
          party={ledgerFor}
          onClose={() => setLedgerFor(null)}
          onChanged={load}
        />
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
  const [mode, setMode] = useState<'bill_to_bill' | 'on_account' | 'advance'>('on_account');
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const [allocs, setAllocs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const inv = await window.surya.ledger.openInvoices(config.partyType, party.partyId);
        setInvoices(inv);
        if (inv.length === 0) setMode('advance'); // no invoices -> advance
      } catch {
        setInvoices([]);
      }
    })();
  }, [config.partyType, party.partyId]);

  const noInvoices = invoices !== null && invoices.length === 0;
  const allocSum = Object.values(allocs).reduce((s, v) => s + (Number(v) || 0), 0);

  // Fill the bill-to-bill inputs FIFO up to the entered amount.
  const autoFill = () => {
    let left = Number(amount) || 0;
    const next: Record<string, string> = {};
    for (const inv of invoices ?? []) {
      if (left <= 0) break;
      const take = Math.min(inv.remaining / 100, left);
      if (take <= 0) continue;
      next[inv.entryId] = String(take);
      left -= take;
    }
    setAllocs(next);
  };

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    if (mode === 'bill_to_bill' && allocSum <= 0) {
      toast.error('Allocate the amount against at least one invoice');
      return;
    }
    if (mode === 'bill_to_bill' && allocSum > amt + 0.001) {
      toast.error('Allocated total exceeds the amount');
      return;
    }
    const payload: any = { partyId: party.partyId, date, amount: amt, description: description || undefined, mode };
    if (mode === 'bill_to_bill') {
      payload.allocations = Object.entries(allocs)
        .map(([invoiceEntryId, v]) => ({ invoiceEntryId, amount: Number(v) || 0 }))
        .filter((a) => a.amount > 0);
    }
    setSaving(true);
    try {
      await config.add(payload);
      toast.success(`${config.actionLabel} recorded`);
      onSaved();
    } catch (err) {
      toast.error('Save failed', { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const modes: { key: typeof mode; label: string; hint: string }[] = [
    { key: 'bill_to_bill', label: 'Bill-to-Bill', hint: 'Pick which invoices to clear' },
    { key: 'on_account', label: 'On-Account', hint: 'Auto-clear oldest first (FIFO)' },
    { key: 'advance', label: 'Advance', hint: 'Keep unapplied' },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {config.actionLabel} — {party.name}
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {config.kind === 'debtor' ? 'Outstanding Amount' : 'Amount Payable'}:{' '}
          <span className="font-semibold">{formatCurrencyPaise(party.outstanding)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Amount (₹) *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Description</Label>
          <Input
            placeholder={config.kind === 'debtor' ? 'Payment received' : 'Payment made'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Clearing method */}
        <div className="grid gap-1.5">
          <Label>Clearing method</Label>
          <div className="grid grid-cols-3 gap-2">
            {modes.map((m) => {
              const disabled = m.key !== 'advance' && noInvoices;
              const active = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    'rounded-md border p-2 text-left transition-colors',
                    disabled
                      ? 'cursor-not-allowed opacity-40'
                      : active
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-accent',
                  )}
                >
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-[11px] text-muted-foreground">{m.hint}</div>
                </button>
              );
            })}
          </div>
          {noInvoices && (
            <div className="text-xs text-muted-foreground">
              No open {config.kind === 'debtor' ? 'invoices' : 'bills'} — this will be recorded as an advance.
            </div>
          )}
        </div>

        {/* Bill-to-bill allocation table */}
        {mode === 'bill_to_bill' && invoices && invoices.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Allocate against invoices</Label>
              <Button type="button" variant="outline" size="sm" onClick={autoFill}>
                Auto-fill FIFO
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-2 text-left font-medium">Voucher</th>
                    <th className="p-2 text-left font-medium">Date</th>
                    <th className="p-2 text-right font-medium">Age</th>
                    <th className="p-2 text-right font-medium">Outstanding</th>
                    <th className="p-2 text-right font-medium">Allocate ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.entryId} className="border-b last:border-0">
                      <td className="p-2 font-medium">{inv.voucher}</td>
                      <td className="p-2">{formatDate(inv.date)}</td>
                      <td className="p-2 text-right">
                        <Badge variant={ageVariant(inv.ageDays) as any}>{inv.ageDays}d</Badge>
                      </td>
                      <td className="p-2 text-right tabular-nums">{formatCurrencyPaise(inv.remaining)}</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          className="h-8 text-right"
                          value={allocs[inv.entryId] ?? ''}
                          onChange={(e) => setAllocs({ ...allocs, [inv.entryId]: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end text-sm">
              <span className="text-muted-foreground">Allocated:&nbsp;</span>
              <span className="font-semibold tabular-nums">
                {formatCurrencyPaise(Math.round(allocSum * 100))}
              </span>
            </div>
          </div>
        )}

        {mode === 'on_account' && !noInvoices && (
          <div className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
            Clears the oldest open {config.kind === 'debtor' ? 'invoices' : 'bills'} first (FIFO).
            Any leftover is kept as an advance.
          </div>
        )}
        {mode === 'advance' && !noInvoices && (
          <div className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
            Kept as an unapplied advance — not matched to any invoice.
          </div>
        )}

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
  onChanged,
}: {
  config: Config;
  party: any;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const [lines, setLines] = useState<any[] | null>(null);
  const [editLine, setEditLine] = useState<any | null>(null);

  const reload = async () => {
    try {
      setLines(await window.surya.ledger.partyEntries(config.partyType, party.partyId));
    } catch (err) {
      toast.error('Failed to load ledger', { description: (err as Error).message });
      setLines([]);
    }
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.partyType, party.partyId]);

  const balLabel = (balance: number) => {
    if (balance === 0) return '—';
    const dr = config.partyType === 'customer' ? balance > 0 : balance < 0;
    return `${formatCurrencyPaise(Math.abs(balance))} ${dr ? 'Dr' : 'Cr'}`;
  };

  const isEditable = (l: any) => l.entryType === 'receipt' || l.entryType === 'payment';

  const remove = async (l: any) => {
    if (!window.confirm(`Delete ${l.voucher}? This cannot be undone.`)) return;
    try {
      await window.surya.ledger.deleteEntry(l.id);
      toast.success('Entry deleted');
      await reload();
      onChanged();
    } catch (err) {
      toast.error('Delete failed', { description: (err as Error).message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l bg-background shadow-xl">
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDate(l.date)}</TableCell>
                    <TableCell className="font-medium">{l.voucher}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {l.description || '—'}
                        {l.advance > 0 && (
                          <Badge variant="warning">Adv {formatCurrencyPaise(l.advance)}</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.debit ? formatCurrencyPaise(l.debit) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.credit ? formatCurrencyPaise(l.credit) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {balLabel(l.balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditable(l) ? (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditLine(l)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(l)} title="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {lines !== null && lines.length === 0 && <TableEmpty>No entries.</TableEmpty>}
        </div>
      </div>

      {editLine && (
        <EditEntryModal
          config={config}
          line={editLine}
          onClose={() => setEditLine(null)}
          onSaved={async () => {
            setEditLine(null);
            await reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
};

const EditEntryModal = ({
  config,
  line,
  onClose,
  onSaved,
}: {
  config: Config;
  line: any;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const originalAmount = config.partyType === 'customer' ? line.credit : line.debit;
  const [date, setDate] = useState<string>(line.date);
  const [amount, setAmount] = useState<string>(String((originalAmount ?? 0) / 100));
  const [description, setDescription] = useState<string>(line.description ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    setSaving(true);
    try {
      await window.surya.ledger.updateEntry({
        entryId: line.id,
        date,
        amount: amt,
        description: description || undefined,
      });
      toast.success('Entry updated — re-cleared on account');
      onSaved();
    } catch (err) {
      toast.error('Save failed', { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit {line.voucher}</DialogTitle>
        </DialogHeader>
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
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            The edited amount is re-cleared on-account (oldest {config.kind === 'debtor' ? 'invoices' : 'bills'} first).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
