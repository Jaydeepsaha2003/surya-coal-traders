import { v4 as uuid } from 'uuid';
import { getDb, getRawSqlite } from '../db';
import { trades, tradeItems, ledgerEntries } from '../../shared/db/schema';
import { eq } from 'drizzle-orm';
import { addPayment, addReceipt } from './ledger';
import {
  rupeesToPaise,
  type TradeFormInput,
  type TradeLineInput,
  type TradeRow,
  type TradeWithItems,
} from '../../shared/types';

const now = () => new Date().toISOString();

// Next trade number, zero-padded. Counts every trade ever created so numbers
// are never reused even after a delete.
const nextTradeNo = (): string => {
  const sqlite = getRawSqlite();
  const row = sqlite
    .prepare(
      `SELECT MAX(CAST(SUBSTR(trade_no, INSTR(trade_no, '-') + 1) AS INTEGER)) AS n FROM trades`,
    )
    .get() as { n: number | null };
  const next = (row?.n ?? 0) + 1;
  return `T-${String(next).padStart(4, '0')}`;
};

const lineAmount = (line: TradeLineInput): number =>
  Math.round((Number(line.qtyTons) || 0) * rupeesToPaise(Number(line.ratePerTon) || 0));

export const listTrades = (search?: string): TradeRow[] => {
  const sqlite = getRawSqlite();
  const rows = sqlite
    .prepare(
      `SELECT t.*,
        (SELECT GROUP_CONCAT(DISTINCT ti.party_name)
           FROM trade_items ti
          WHERE ti.trade_id = t.id AND ti.side = 'purchase' AND ti.party_name IS NOT NULL) AS supplier_names,
        (SELECT GROUP_CONCAT(DISTINCT ti.party_name)
           FROM trade_items ti
          WHERE ti.trade_id = t.id AND ti.side = 'sale' AND ti.party_name IS NOT NULL) AS customer_names
       FROM trades t
      WHERE t.deleted_at IS NULL
      ORDER BY t.date DESC, t.trade_no DESC`,
    )
    .all() as any[];

  const mapped: TradeRow[] = rows.map((r) => ({
    id: r.id,
    tradeNo: r.trade_no,
    purchaseVoucher: r.purchase_voucher,
    saleVoucher: r.sale_voucher,
    date: r.date,
    lorryNo: r.lorry_no,
    grade: r.grade,
    fromLocation: r.from_location,
    toLocation: r.to_location,
    totalPurchase: r.total_purchase,
    totalSale: r.total_sale,
    grossProfit: r.gross_profit,
    transporterId: r.transporter_id,
    transporterName: r.transporter_name,
    transportMode: r.transport_mode,
    transportQty: r.transport_qty,
    transportRate: r.transport_rate,
    transportCost: r.transport_cost,
    transportChargedToCustomer: r.transport_charged_to_customer,
    remarks: r.remarks,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    supplierNames: r.supplier_names ?? '',
    customerNames: r.customer_names ?? '',
  }));

  if (!search?.trim()) return mapped;
  const q = search.trim().toLowerCase();
  return mapped.filter((t) =>
    [t.tradeNo, t.lorryNo, t.fromLocation, t.toLocation, t.supplierNames, t.customerNames]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
};

export const recentTrades = (limit = 10): TradeRow[] => listTrades().slice(0, limit);

export const getTrade = (id: string): TradeWithItems | null => {
  const db = getDb();
  const trade = db.select().from(trades).where(eq(trades.id, id)).get();
  if (!trade) return null;
  const items = db.select().from(tradeItems).where(eq(tradeItems.tradeId, id)).all();
  return {
    ...trade,
    purchaseItems: items.filter((i) => i.side === 'purchase'),
    saleItems: items.filter((i) => i.side === 'sale'),
  };
};

// Aggregate item amounts by party so the ledger gets one clean voucher line
// per party per trade.
const groupByParty = (lines: TradeLineInput[]) => {
  const map = new Map<string, { name: string | null; amount: number }>();
  for (const line of lines) {
    if (!line.partyId) continue;
    const amount = lineAmount(line);
    if (amount <= 0) continue;
    const prev = map.get(line.partyId);
    if (prev) prev.amount += amount;
    else map.set(line.partyId, { name: line.partyName ?? null, amount });
  }
  return map;
};

type Derived = ReturnType<typeof derive>;

const derive = (input: TradeFormInput) => {
  const purchaseRows = (input.purchaseItems ?? []).filter(
    (l) => (Number(l.qtyTons) || 0) > 0 || (Number(l.ratePerTon) || 0) > 0 || l.partyId,
  );
  const saleRows = (input.saleItems ?? []).filter(
    (l) => (Number(l.qtyTons) || 0) > 0 || (Number(l.ratePerTon) || 0) > 0 || l.partyId,
  );
  const totalPurchase = purchaseRows.reduce((s, l) => s + lineAmount(l), 0);
  const totalSale = saleRows.reduce((s, l) => s + lineAmount(l), 0);

  const transportMode = input.transportMode === 'fixed' ? 'fixed' : 'per_ton';
  const transportQty = Number(input.transportQty) || 0;
  const transportRatePaise = rupeesToPaise(Number(input.transportRate) || 0);
  const transportCost =
    transportMode === 'fixed'
      ? rupeesToPaise(Number(input.transportFixed) || 0)
      : Math.round(transportQty * transportRatePaise);

  const primaryCustomerId = saleRows.find((l) => l.partyId)?.partyId ?? null;
  const primarySupplierId = purchaseRows.find((l) => l.partyId)?.partyId ?? null;

  // Transport is always billed to the customer (when one exists) and is never
  // part of profit — it is a pass-through recovery.
  const chargeToCustomer = !!primaryCustomerId && transportCost > 0;
  const grossProfit = totalSale - totalPurchase;

  return {
    purchaseRows,
    saleRows,
    totalPurchase,
    totalSale,
    transportMode: transportMode as 'per_ton' | 'fixed',
    transportQty,
    transportRatePaise,
    transportCost,
    primaryCustomerId,
    primarySupplierId,
    chargeToCustomer,
    grossProfit,
  };
};

const tradeColumnValues = (input: TradeFormInput, d: Derived) => ({
  purchaseVoucher: input.purchaseVoucher?.trim() || null,
  saleVoucher: input.saleVoucher?.trim() || null,
  date: input.date,
  lorryNo: input.lorryNo ?? null,
  grade: input.grade || null,
  fromLocation: input.fromLocation ?? null,
  toLocation: input.toLocation ?? null,
  totalPurchase: d.totalPurchase,
  totalSale: d.totalSale,
  grossProfit: d.grossProfit,
  transporterId: input.transporterId ?? null,
  transporterName: input.transporterName ?? null,
  transportMode: d.transportMode,
  transportQty: d.transportQty,
  transportRate: d.transportRatePaise,
  transportCost: d.transportCost,
  transportChargedToCustomer: d.chargeToCustomer ? 1 : 0,
  remarks: input.remarks ?? null,
});

// Insert this trade's line items and its supplier/customer ledger postings.
const writeItemsAndLedger = (tradeId: string, tradeNo: string, input: TradeFormInput, d: Derived) => {
  const db = getDb();
  const insertItem = (side: 'purchase' | 'sale', line: TradeLineInput) => {
    db.insert(tradeItems)
      .values({
        id: uuid(),
        tradeId,
        side,
        partyId: line.partyId ?? null,
        partyName: line.partyName ?? null,
        particulars: line.particulars ?? null,
        location: line.location ?? null,
        qtyTons: Number(line.qtyTons) || 0,
        ratePerTon: rupeesToPaise(Number(line.ratePerTon) || 0),
        amount: lineAmount(line),
      })
      .run();
  };
  d.purchaseRows.forEach((l) => insertItem('purchase', l));
  d.saleRows.forEach((l) => insertItem('sale', l));

  const routeDesc = [input.fromLocation, input.toLocation].filter(Boolean).join(' → ');
  const purchaseVoucher = input.purchaseVoucher?.trim() || tradeNo;
  const saleVoucher = input.saleVoucher?.trim() || tradeNo;

  for (const [partyId, info] of groupByParty(d.purchaseRows)) {
    db.insert(ledgerEntries)
      .values({
        id: uuid(),
        partyType: 'supplier',
        partyId,
        tradeId,
        entryType: 'trade',
        date: input.date,
        voucher: purchaseVoucher,
        description: `Purchase${routeDesc ? ' · ' + routeDesc : ''}`,
        debit: 0,
        credit: info.amount,
      })
      .run();
  }

  for (const [partyId, info] of groupByParty(d.saleRows)) {
    const addTransport = d.chargeToCustomer && partyId === d.primaryCustomerId;
    const debit = info.amount + (addTransport ? d.transportCost : 0);
    db.insert(ledgerEntries)
      .values({
        id: uuid(),
        partyType: 'customer',
        partyId,
        tradeId,
        entryType: 'trade',
        date: input.date,
        voucher: saleVoucher,
        description: `Sale${routeDesc ? ' · ' + routeDesc : ''}${addTransport ? ' · incl. transport' : ''}`,
        debit,
        credit: 0,
      })
      .run();
  }
};

export const createTrade = (input: TradeFormInput): string => {
  if (!input.date) throw new Error('Trade date is required');
  const id = uuid();
  const tradeNo = nextTradeNo();
  const d = derive(input);

  const sqlite = getRawSqlite();
  const tx = sqlite.transaction(() => {
    getDb()
      .insert(trades)
      .values({ id, tradeNo, ...tradeColumnValues(input, d) })
      .run();
    writeItemsAndLedger(id, tradeNo, input, d);
  });
  tx();

  // On-the-spot cash entered on the trade — posted after commit so the new
  // invoice/bill exists and on-account FIFO can clear it.
  if (d.primaryCustomerId && Number(input.receivedFromCustomer) > 0) {
    addReceipt({
      partyId: d.primaryCustomerId,
      date: input.date,
      amount: Number(input.receivedFromCustomer),
      description: `Received on trade ${tradeNo}`,
      mode: 'on_account',
      tradeId: id, // links it to the trade so it's removed if the trade is deleted
    });
  }
  if (d.primarySupplierId && Number(input.paidToSupplier) > 0) {
    addPayment({
      partyId: d.primarySupplierId,
      date: input.date,
      amount: Number(input.paidToSupplier),
      description: `Paid on trade ${tradeNo}`,
      mode: 'on_account',
      tradeId: id,
    });
  }

  return id;
};

// Edit a trade: replaces its line items and ledger postings, keeping the same
// trade number. NOTE: receipts already recorded against this trade's invoice
// stay, but any that were auto-allocated to it revert to advances (they can be
// re-applied from the ledger). On-the-spot cash fields are ignored on edit.
export const updateTrade = (id: string, input: TradeFormInput): string => {
  if (!input.date) throw new Error('Trade date is required');
  const db = getDb();
  const existing = db.select().from(trades).where(eq(trades.id, id)).get();
  if (!existing) throw new Error('Trade not found');
  const tradeNo = existing.tradeNo;
  const d = derive(input);

  const sqlite = getRawSqlite();
  const tx = sqlite.transaction(() => {
    sqlite.prepare(`DELETE FROM trade_items WHERE trade_id = ?`).run(id);
    // Only remove the trade's own invoice/bill postings — keep any on-trade
    // receipt/payment cash entries (they represent real money movements).
    sqlite
      .prepare(`DELETE FROM ledger_entries WHERE trade_id = ? AND entry_type = 'trade'`)
      .run(id);
    db.update(trades)
      .set({ ...tradeColumnValues(input, d), updatedAt: new Date().toISOString() })
      .where(eq(trades.id, id))
      .run();
    writeItemsAndLedger(id, tradeNo, input, d);
  });
  tx();
  return id;
};

// Hard delete — cascades to trade_items and the trade's ledger postings,
// keeping debtor/creditor balances correct. Receipts/payments (trade_id NULL)
// are untouched.
export const deleteTrade = (id: string) => {
  const db = getDb();
  db.delete(trades).where(eq(trades.id, id)).run();
};
