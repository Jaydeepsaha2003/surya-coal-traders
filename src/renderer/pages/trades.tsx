import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Eye, Trash2, X, Pencil } from 'lucide-react';
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

type Party = { id: string; name: string; location?: string | null };
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
  const [editTrade, setEditTrade] = useState<any | null>(null);
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

  const openEdit = async (id: string) => {
    try {
      const t = await window.surya.trades.get(id);
      setEditTrade(t);
      setFormOpen(true);
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
        <Button
          onClick={() => {
            setEditTrade(null);
            setFormOpen(true);
          }}
        >
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
                    <Button variant="ghost" size="icon" onClick={() => openDetail(t.id)} title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t.id)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t)} title="Delete">
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
          trade={editTrade}
          onClose={() => {
            setFormOpen(false);
            setEditTrade(null);
          }}
          onSaved={() => {
            setFormOpen(false);
            setEditTrade(null);
            load();
          }}
        />
      )}
      {detail && <TradeDetailModal trade={detail} onClose={() => setDetail(null)} />}
    </div>
  );
};

// --------------------------- New Trade form ---------------------------

const itemToLine = (it: any): Line => ({
  partyId: it.partyId ?? '',
  particulars: it.particulars ?? '',
  location: it.location ?? '',
  qty: it.qtyTons ? String(it.qtyTons) : '',
  rate: it.ratePerTon ? String(it.ratePerTon / 100) : '',
});

const TradeFormModal = ({
  trade,
  onClose,
  onSaved,
}: {
  trade?: any | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const isEdit = !!trade;
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [transporters, setTransporters] = useState<Party[]>([]);
  const [date, setDate] = useState(trade?.date ?? isoToday());
  const [lorryNo, setLorryNo] = useState(trade?.lorryNo ?? '');
  const [grade, setGrade] = useState(trade?.grade ?? '');
  const [from, setFrom] = useState(trade?.fromLocation ?? '');
  const [to, setTo] = useState(trade?.toLocation ?? '');
  const [remarks, setRemarks] = useState(trade?.remarks ?? '');
  const [purchaseVoucher, setPurchaseVoucher] = useState(trade?.purchaseVoucher ?? '');
  const [saleVoucher, setSaleVoucher] = useState(trade?.saleVoucher ?? '');
  const [purchase, setPurchase] = useState<Line[]>(
    trade?.purchaseItems?.length ? trade.purchaseItems.map(itemToLine) : [blankLine()],
  );
  const [sale, setSale] = useState<Line[]>(
    trade?.saleItems?.length ? trade.saleItems.map(itemToLine) : [blankLine()],
  );
  const [saving, setSaving] = useState(false);
  // Transport
  const [transporterId, setTransporterId] = useState(trade?.transporterId ?? '');
  const [transportMode, setTransportMode] = useState<'per_ton' | 'fixed'>(
    trade?.transportMode === 'fixed' ? 'fixed' : 'per_ton',
  );
  const [transportQty, setTransportQty] = useState(trade?.transportQty ? String(trade.transportQty) : '');
  const [transportRate, setTransportRate] = useState(
    trade?.transportRate ? String(trade.transportRate / 100) : '',
  );
  const [transportFixed, setTransportFixed] = useState(
    trade?.transportMode === 'fixed' && trade?.transportCost ? String(trade.transportCost / 100) : '',
  );
  // On-the-spot cash (create only)
  const [received, setReceived] = useState('');
  const [paid, setPaid] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, c, t] = await Promise.all([
          window.surya.suppliers.list(),
          window.surya.customers.list(),
          window.surya.transporters.list(),
        ]);
        setSuppliers(s);
        setCustomers(c);
        setTransporters(t);
      } catch (err) {
        toast.error('Failed to load masters', { description: (err as Error).message });
      }
    })();
  }, []);

  const totalPurchase = useMemo(() => purchase.reduce((s, l) => s + lineAmount(l), 0), [purchase]);
  const totalSale = useMemo(() => sale.reduce((s, l) => s + lineAmount(l), 0), [sale]);
  const hasCustomer = sale.some((l) => l.partyId);
  const transportCost =
    transportMode === 'fixed'
      ? Number(transportFixed) || 0
      : (Number(transportQty) || 0) * (Number(transportRate) || 0);
  // Transport is always billed to the customer (when one exists) and never in profit.
  const transportBilled = hasCustomer && transportCost > 0;
  const grossProfit = totalSale - totalPurchase;
  const customerValue = totalSale + (transportBilled ? transportCost : 0);
  const customerReceivable = customerValue - (Number(received) || 0);

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
    const payload: any = {
      date,
      purchaseVoucher: purchaseVoucher || undefined,
      saleVoucher: saleVoucher || undefined,
      lorryNo: lorryNo || undefined,
      grade: grade || '',
      fromLocation: from || undefined,
      toLocation: to || undefined,
      remarks: remarks || undefined,
      purchaseItems: purchase.map((l) => toLine(l, suppliers)),
      saleItems: sale.map((l) => toLine(l, customers)),
      transporterId: transporterId || null,
      transporterName: transporters.find((p) => p.id === transporterId)?.name ?? null,
      transportMode,
      transportQty: Number(transportQty) || 0,
      transportRate: Number(transportRate) || 0,
      transportFixed: Number(transportFixed) || 0,
      transportChargedToCustomer: true,
    };
    setSaving(true);
    try {
      if (isEdit) {
        await window.surya.trades.update(trade.id, payload);
        toast.success('Trade updated — ledgers adjusted');
      } else {
        payload.receivedFromCustomer = Number(received) || 0;
        payload.paidToSupplier = Number(paid) || 0;
        await window.surya.trades.create(payload);
        toast.success('Trade saved — ledgers updated');
      }
      onSaved();
    } catch (err) {
      toast.error('Save failed', { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-[1400px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit Trade ${trade.tradeNo}` : 'New Trade Entry'} — Purchase + Sale · Auto P&amp;L
          </DialogTitle>
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
          voucher={purchaseVoucher}
          onVoucher={setPurchaseVoucher}
        />
        <LineEditor
          title="Sale Items"
          accent="text-emerald-600"
          partyLabel="Customer"
          parties={customers}
          lines={sale}
          setLines={setSale}
          voucher={saleVoucher}
          onVoucher={setSaleVoucher}
        />

        {/* Transportation */}
        <section className="space-y-2 rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-sky-600">Transportation</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Transporter">
              <Select value={transporterId} onValueChange={setTransporterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {transporters.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cost basis">
              <div className="flex gap-1">
                {(['per_ton', 'fixed'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTransportMode(m)}
                    className={
                      'flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ' +
                      (transportMode === m ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent')
                    }
                  >
                    {m === 'per_ton' ? 'Per Ton' : 'Fixed'}
                  </button>
                ))}
              </div>
            </Field>
            {transportMode === 'per_ton' ? (
              <>
                <Field label="Qty (T)">
                  <Input
                    type="number"
                    value={transportQty}
                    onChange={(e) => setTransportQty(e.target.value)}
                  />
                </Field>
                <Field label="Rate/Ton (₹)">
                  <Input
                    type="number"
                    value={transportRate}
                    onChange={(e) => setTransportRate(e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <Field label="Fixed fee (₹)">
                <Input
                  type="number"
                  value={transportFixed}
                  onChange={(e) => setTransportFixed(e.target.value)}
                />
              </Field>
            )}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              Always billed to the customer · not counted in profit (pass-through).
            </span>
            <div className="text-sm">
              <span className="text-muted-foreground">Transport cost:&nbsp;</span>
              <span className="font-semibold tabular-nums">
                {formatCurrencyPaise(Math.round(transportCost * 100))}
              </span>
            </div>
          </div>
        </section>

        {/* On-the-spot payments — new trades only */}
        {!isEdit && (
          <section className="grid grid-cols-1 gap-3 rounded-lg border p-4 md:grid-cols-2">
            <Field label="Received from customer now (₹)">
              <Input
                type="number"
                placeholder="0"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </Field>
            <Field label="Paid to supplier now (₹)">
              <Input
                type="number"
                placeholder="0"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </Field>
          </section>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-4 md:grid-cols-5">
          <Summary label="Total Purchase" value={totalPurchase} />
          <Summary label="Total Sale" value={totalSale} />
          <Summary label="Transport" value={transportCost} className="text-sky-600" />
          <Summary label="Customer Value" value={customerValue} />
          <Summary
            label="Gross Profit"
            value={grossProfit}
            className={grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Customer sale value ={' '}
          <span className="font-medium text-foreground">{formatCurrencyPaise(Math.round(totalSale * 100))}</span>
          {transportBilled ? (
            <>
              {' '}
              + transport{' '}
              <span className="font-medium text-sky-600">{formatCurrencyPaise(Math.round(transportCost * 100))}</span> ={' '}
              <span className="font-medium text-foreground">{formatCurrencyPaise(Math.round(customerValue * 100))}</span>
            </>
          ) : null}
          . Transport is billed to the customer but excluded from profit.
          {!isEdit && Number(received) > 0
            ? ` Balance after ₹${received} received now: ${formatCurrencyPaise(Math.round(customerReceivable * 100))}.`
            : ''}
          {!hasCustomer && transportCost > 0
            ? ' Add a customer to bill the transport charge.'
            : ''}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update Trade' : 'Save Trade'}
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
  voucher,
  onVoucher,
}: {
  title: string;
  accent: string;
  partyLabel: string;
  parties: Party[];
  lines: Line[];
  setLines: React.Dispatch<React.SetStateAction<Line[]>>;
  voucher: string;
  onVoucher: (v: string) => void;
}) => {
  const update = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeRow = (i: number) =>
    setLines((prev) => (prev.length === 1 ? [blankLine()] : prev.filter((_, idx) => idx !== i)));

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={`text-sm font-semibold ${accent}`}>{title}</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label className="whitespace-nowrap text-xs text-muted-foreground">Voucher No</Label>
            <Input
              className="h-8 w-40"
              placeholder="Auto (Tally optional)"
              value={voucher}
              onChange={(e) => onVoucher(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, blankLine()])}>
            <Plus className="h-3.5 w-3.5" /> Add Row
          </Button>
        </div>
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
                  <Select
                    value={l.partyId}
                    onValueChange={(v) => {
                      const loc = parties.find((p) => p.id === v)?.location;
                      update(i, { partyId: v, ...(loc ? { location: loc } : {}) });
                    }}
                  >
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
        <Info label="Purchase Voucher" value={trade.purchaseVoucher || trade.tradeNo} />
        <Info label="Sale Voucher" value={trade.saleVoucher || trade.tradeNo} />
      </div>

      <ItemTable title="Purchase Items" items={trade.purchaseItems} />
      <ItemTable title="Sale Items" items={trade.saleItems} />

      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-4 md:grid-cols-4">
        <Info label="Total Purchase" value={formatCurrencyPaise(trade.totalPurchase)} />
        <Info label="Total Sale" value={formatCurrencyPaise(trade.totalSale)} />
        <Info
          label={`Transport${trade.transportChargedToCustomer ? ' (to customer)' : ' (borne)'}`}
          value={formatCurrencyPaise(trade.transportCost)}
        />
        <Info
          label="Gross Profit"
          value={formatCurrencyPaise(trade.grossProfit)}
          valueClass={trade.grossProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        Customer billed ={' '}
        <span className="font-medium text-foreground">{formatCurrencyPaise(trade.totalSale)}</span>
        {trade.transportChargedToCustomer && trade.transportCost > 0 ? (
          <>
            {' '}
            + transport{' '}
            <span className="font-medium text-sky-600">{formatCurrencyPaise(trade.transportCost)}</span> ={' '}
            <span className="font-medium text-foreground">
              {formatCurrencyPaise(trade.totalSale + trade.transportCost)}
            </span>
          </>
        ) : null}
        . Transport is a pass-through — not counted in profit.
      </div>
      {(trade.transporterName || trade.transportCost > 0) && (
        <div className="text-xs text-muted-foreground">
          Transporter: {trade.transporterName || '—'}
          {trade.transportMode === 'per_ton' && trade.transportQty
            ? ` · ${trade.transportQty} T × ${formatCurrencyPaise(trade.transportRate)}/T`
            : trade.transportMode === 'fixed'
              ? ' · fixed fee'
              : ''}
        </div>
      )}

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
