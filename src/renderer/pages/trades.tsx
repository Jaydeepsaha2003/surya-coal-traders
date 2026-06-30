import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Eye, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { DateRangeFilter, type Range } from '@/components/date-range';
import { COAL_GRADES } from '@shared/types';
import { formatCurrencyPaise, formatDate, isoToday } from '@/lib/utils';

type Party = { id: string; name: string };
type Line = {
  partyId: string;
  particulars: string;
  location: string;
  qty: string;
  rate: string;
};

const blankLine = (): Line => ({ partyId: '', particulars: '', location: '', qty: '', rate: '' });
const lineAmount = (l: Line) => (Number(l.qty) || 0) * (Number(l.rate) || 0);

export const TradesPage = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<Range>({ from: '', to: '' });
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const load = async () => {
    try {
      setRows(await window.surya.trades.list());
    } catch (err) {
      toast.error('Failed to load trades', { description: (err as Error).message });
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((t) => {
    const matchesSearch = [
      t.tradeNo,
      t.lorryNo,
      t.fromLocation,
      t.toLocation,
      t.supplierNames,
      t.customerNames,
    ]
      .filter(Boolean)
      .some((v: string) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchesFrom = !range.from || t.date >= range.from;
    const matchesTo = !range.to || t.date <= range.to;
    return matchesSearch && matchesFrom && matchesTo;
  });

  const openDetail = async (id: string) => {
    try {
      setDetail(await window.surya.trades.get(id));
    } catch (err) {
      toast.error('Failed to open trade', { description: (err as Error).message });
    }
  };

  const remove = async (t: any) => {
    if (!window.confirm(`Delete trade ${t.tradeNo}? This also removes its ledger postings.`)) return;
    try {
      await window.surya.trades.remove(t.id);
      toast.success('Trade deleted');
      load();
    } catch (err) {
      toast.error('Delete failed', { description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trade no, lorry, route…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> New Trade
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trade No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Lorry No</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead className="text-right">Purchase</TableHead>
              <TableHead className="text-right">Sale</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.tradeNo}</TableCell>
                <TableCell>{formatDate(t.date)}</TableCell>
                <TableCell>{t.lorryNo || '—'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[t.fromLocation, t.toLocation].filter(Boolean).join(' → ') || '—'}
                </TableCell>
                <TableCell>{t.grade ? <Badge variant="secondary">{t.grade}</Badge> : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyPaise(t.totalPurchase)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyPaise(t.totalSale)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  <span className={t.grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                    {formatCurrencyPaise(t.grossProfit)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openDetail(t.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <TableEmpty>No trades yet. Click “New Trade”.</TableEmpty>}
      </Card>

      {formOpen && (
        <TradeFormModal
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}
      {detail && <TradeDetailModal trade={detail} onClose={() => setDetail(null)} />}
    </div>
  );
};

// --------------------------- New Trade form ---------------------------

const TradeFormModal = ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => {
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [date, setDate] = useState(isoToday());
  const [lorryNo, setLorryNo] = useState('');
  const [grade, setGrade] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [purchase, setPurchase] = useState<Line[]>([blankLine()]);
  const [sale, setSale] = useState<Line[]>([blankLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([
          window.surya.suppliers.list(),
          window.surya.customers.list(),
        ]);
        setSuppliers(s);
        setCustomers(c);
      } catch (err) {
        toast.error('Failed to load masters', { description: (err as Error).message });
      }
    })();
  }, []);

  const totalPurchase = useMemo(() => purchase.reduce((s, l) => s + lineAmount(l), 0), [purchase]);
  const totalSale = useMemo(() => sale.reduce((s, l) => s + lineAmount(l), 0), [sale]);
  const grossProfit = totalSale - totalPurchase;

  const save = async () => {
    if (!date) {
      toast.error('Trade date is required');
      return;
    }
    const toLine = (l: Line, parties: Party[]) => ({
      partyId: l.partyId || null,
      partyName: parties.find((p) => p.id === l.partyId)?.name ?? null,
      particulars: l.particulars || undefined,
      location: l.location || undefined,
      qtyTons: Number(l.qty) || 0,
      ratePerTon: Number(l.rate) || 0,
    });
    setSaving(true);
    try {
      await window.surya.trades.create({
        date,
        lorryNo: lorryNo || undefined,
        grade: grade || '',
        fromLocation: from || undefined,
        toLocation: to || undefined,
        remarks: remarks || undefined,
        purchaseItems: purchase.map((l) => toLine(l, suppliers)),
        saleItems: sale.map((l) => toLine(l, customers)),
      });
      toast.success('Trade saved — ledgers updated');
      onSaved();
    } catch (err) {
      toast.error('Save failed', { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Trade Entry — Purchase + Sale · Auto P&amp;L</DialogTitle>
        </DialogHeader>

        {/* Trade information */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Field label="Date *">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Lorry No">
            <Input
              placeholder="AP35Y 5499"
              value={lorryNo}
              onChange={(e) => setLorryNo(e.target.value)}
            />
          </Field>
          <Field label="Coal Grade">
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {COAL_GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="From">
            <Input value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Remarks">
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
        </section>

        <LineEditor
          title="Purchase Items"
          accent="text-primary"
          partyLabel="Supplier"
          parties={suppliers}
          lines={purchase}
          setLines={setPurchase}
        />
        <LineEditor
          title="Sale Items"
          accent="text-emerald-600"
          partyLabel="Customer"
          parties={customers}
          lines={sale}
          setLines={setSale}
        />

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-4">
          <Summary label="Total Purchase" value={totalPurchase} />
          <Summary label="Total Sale" value={totalSale} />
          <Summary
            label="Gross Profit"
            value={grossProfit}
            className={grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Trade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LineEditor = ({
  title,
  accent,
  partyLabel,
  parties,
  lines,
  setLines,
}: {
  title: string;
  accent: string;
  partyLabel: string;
  parties: Party[];
  lines: Line[];
  setLines: React.Dispatch<React.SetStateAction<Line[]>>;
}) => {
  const update = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeRow = (i: number) =>
    setLines((prev) => (prev.length === 1 ? [blankLine()] : prev.filter((_, idx) => idx !== i)));

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-semibold ${accent}`}>{title}</h3>
        <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, blankLine()])}>
          <Plus className="h-3.5 w-3.5" /> Add Row
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-2 text-left font-medium">{partyLabel}</th>
              <th className="p-2 text-left font-medium">Particulars</th>
              <th className="p-2 text-left font-medium">Location</th>
              <th className="p-2 text-right font-medium">Qty (T)</th>
              <th className="p-2 text-right font-medium">Rate/Ton</th>
              <th className="p-2 text-right font-medium">Amount</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-1.5 align-top" style={{ minWidth: 160 }}>
                  <Select value={l.partyId} onValueChange={(v) => update(i, { partyId: v })}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={`Select ${partyLabel.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {parties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1.5">
                  <Input
                    className="h-8"
                    value={l.particulars}
                    onChange={(e) => update(i, { particulars: e.target.value })}
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    className="h-8"
                    value={l.location}
                    onChange={(e) => update(i, { location: e.target.value })}
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    className="h-8 text-right"
                    type="number"
                    value={l.qty}
                    onChange={(e) => update(i, { qty: e.target.value })}
                  />
                </td>
                <td className="p-1.5">
                  <Input
                    className="h-8 text-right"
                    type="number"
                    value={l.rate}
                    onChange={(e) => update(i, { rate: e.target.value })}
                  />
                </td>
                <td className="p-1.5 text-right tabular-nums">
                  {formatCurrencyPaise(Math.round(lineAmount(l) * 100))}
                </td>
                <td className="p-1.5 text-center">
                  <button
                    onClick={() => removeRow(i)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove row"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const Summary = ({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-lg font-semibold tabular-nums ${className ?? ''}`}>
      {formatCurrencyPaise(Math.round(value * 100))}
    </div>
  </div>
);

// --------------------------- Detail view ---------------------------

const TradeDetailModal = ({ trade, onClose }: { trade: any; onClose: () => void }) => (
  <Dialog open onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Trade {trade.tradeNo}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Info label="Date" value={formatDate(trade.date)} />
        <Info label="Lorry No" value={trade.lorryNo || '—'} />
        <Info label="Grade" value={trade.grade || '—'} />
        <Info
          label="Route"
          value={[trade.fromLocation, trade.toLocation].filter(Boolean).join(' → ') || '—'}
        />
      </div>

      <ItemTable title="Purchase Items" items={trade.purchaseItems} />
      <ItemTable title="Sale Items" items={trade.saleItems} />

      <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-4">
        <Info label="Total Purchase" value={formatCurrencyPaise(trade.totalPurchase)} />
        <Info label="Total Sale" value={formatCurrencyPaise(trade.totalSale)} />
        <Info
          label="Gross Profit"
          value={formatCurrencyPaise(trade.grossProfit)}
          valueClass={trade.grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}
        />
      </div>

      {trade.remarks && (
        <div className="text-sm">
          <div className="text-xs text-muted-foreground">Remarks</div>
          <div>{trade.remarks}</div>
        </div>
      )}
    </DialogContent>
  </Dialog>
);

const ItemTable = ({ title, items }: { title: string; items: any[] }) => (
  <section className="space-y-1.5">
    <h3 className="text-sm font-semibold">{title}</h3>
    {items.length === 0 ? (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">No items</div>
    ) : (
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-2 text-left font-medium">Party</th>
              <th className="p-2 text-left font-medium">Particulars</th>
              <th className="p-2 text-right font-medium">Qty (T)</th>
              <th className="p-2 text-right font-medium">Rate/Ton</th>
              <th className="p-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b last:border-0">
                <td className="p-2">{it.partyName || '—'}</td>
                <td className="p-2">{it.particulars || '—'}</td>
                <td className="p-2 text-right tabular-nums">{it.qtyTons}</td>
                <td className="p-2 text-right tabular-nums">{formatCurrencyPaise(it.ratePerTon)}</td>
                <td className="p-2 text-right tabular-nums">{formatCurrencyPaise(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);

const Info = ({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`font-medium ${valueClass ?? ''}`}>{value}</div>
  </div>
);
